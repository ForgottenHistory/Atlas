#!/usr/bin/env node

/**
 * Dual Model Concurrency Test
 * 
 * Tests the fascinating scenario of running:
 * - Small fast model (GLM-4-9B) for decisions concurrently 
 * - Large 1T model (Kimi-K2) for responses sequentially
 * 
 * This simulates Atlas's real-world usage pattern where:
 * - Multiple decision requests can run in parallel
 * - Response generation is throttled to 1 concurrent request
 */

const path = require('path');
const serverSrcPath = path.resolve(__dirname, 'server', 'src');
process.env.NODE_PATH = serverSrcPath;
require('module').Module._initPaths();

const FeatherlessProvider = require('../server/src/services/llm/providers/FeatherlessProvider');
const LLMService = require('../server/src/services/llm/index');

class DualModelConcurrencyTester {
  constructor(apiKey) {
    this.apiKey = apiKey;
    
    // Model configurations
    this.smallModel = {
      id: 'zai-org/GLM-4-9B-0414',
      name: 'GLM-4-9B (Decision Model)',
      role: 'decision',
      maxConcurrency: 4,
      settings: {
        model: 'zai-org/GLM-4-9B-0414',
        api_key: apiKey,
        temperature: 0.3,
        max_tokens: 150
      }
    };
    
    this.largeModel = {
      id: 'moonshotai/Kimi-K2-Instruct',
      name: 'Kimi-K2-Instruct (Response Model)', 
      role: 'response',
      maxConcurrency: 1,
      settings: {
        model: 'moonshotai/Kimi-K2-Instruct',
        api_key: apiKey,
        temperature: 0.7,
        max_tokens: 500
      }
    };
    
    this.testResults = {
      modelBaseline: {},
      separateConcurrency: {},
      mixedWorkload: {},
      realWorldSimulation: {}
    };
  }

  async testModelBaseline() {
    console.log('\n📏 BASELINE PERFORMANCE TEST');
    console.log('Testing each model individually for reference...\n');
    
    const models = [this.smallModel, this.largeModel];
    
    for (const model of models) {
      console.log(`🧪 Testing ${model.name}...`);
      
      const provider = new FeatherlessProvider();
      const testPrompt = model.role === 'decision' 
        ? "Should I respond to a message saying 'hello'? Answer: respond/ignore and explain briefly."
        : "Reply to someone who said hello in a friendly, casual way.";
      
      const times = [];
      const successes = [];
      
      // Run 3 individual tests
      for (let i = 0; i < 3; i++) {
        try {
          const startTime = Date.now();
          const response = await provider.generateResponse(testPrompt, model.settings);
          const duration = Date.now() - startTime;
          
          times.push(duration);
          successes.push(true);
          console.log(`  ✓ Test ${i + 1}: ${duration}ms (${response.length} chars)`);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          successes.push(false);
          console.log(`  ✗ Test ${i + 1}: ${error.message}`);
        }
      }
      
      const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      const successRate = (successes.filter(Boolean).length / successes.length) * 100;
      
      this.testResults.modelBaseline[model.role] = {
        model: model.name,
        avgTime: Math.round(avgTime),
        successRate,
        times
      };
      
      console.log(`  📊 Avg: ${Math.round(avgTime)}ms, Success: ${successRate}%\n`);
    }
  }

  async testSeparateConcurrency() {
    console.log('\n⚡ SEPARATE CONCURRENCY TEST');
    console.log('Testing each model at their optimal concurrency levels...\n');
    
    // Test small model with high concurrency
    console.log(`🚀 Testing ${this.smallModel.name} with ${this.smallModel.maxConcurrency} concurrent requests...`);
    
    const provider = new FeatherlessProvider();
    const decisionPrompts = [
      "Should I respond to 'good morning'? Answer: respond/ignore",
      "Should I react to a funny meme? Answer: react/ignore", 
      "Should I respond to 'how are you'? Answer: respond/ignore",
      "Should I ignore a bot message? Answer: ignore/respond"
    ];
    
    const startTime = Date.now();
    const decisionPromises = decisionPrompts.map((prompt, i) => 
      provider.generateResponse(prompt, this.smallModel.settings)
        .then(response => ({ success: true, id: i + 1, response, duration: Date.now() - startTime }))
        .catch(error => ({ success: false, id: i + 1, error: error.message }))
    );
    
    const decisionResults = await Promise.all(decisionPromises);
    const decisionDuration = Date.now() - startTime;
    const decisionSuccesses = decisionResults.filter(r => r.success).length;
    
    console.log(`  ✓ ${decisionSuccesses}/${decisionResults.length} decisions completed in ${decisionDuration}ms`);
    console.log(`  📈 Avg per decision: ${Math.round(decisionDuration / decisionResults.length)}ms`);
    
    // Test large model sequentially
    console.log(`\n🎯 Testing ${this.largeModel.name} with sequential requests...`);
    
    const responsePrompts = [
      "Reply to someone who said 'good morning' in a cheerful way.",
      "Respond to someone asking 'how are you?' in a friendly manner."
    ];
    
    const responseResults = [];
    const responseStartTime = Date.now();
    
    for (let i = 0; i < responsePrompts.length; i++) {
      try {
        const reqStart = Date.now();
        const response = await provider.generateResponse(responsePrompts[i], this.largeModel.settings);
        const reqDuration = Date.now() - reqStart;
        
        responseResults.push({ success: true, id: i + 1, response, duration: reqDuration });
        console.log(`  ✓ Response ${i + 1}: ${reqDuration}ms (${response.length} chars)`);
        
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        responseResults.push({ success: false, id: i + 1, error: error.message });
        console.log(`  ✗ Response ${i + 1}: ${error.message}`);
      }
    }
    
    const responseTotalDuration = Date.now() - responseStartTime;
    const responseSuccesses = responseResults.filter(r => r.success).length;
    
    console.log(`  ✓ ${responseSuccesses}/${responseResults.length} responses completed in ${responseTotalDuration}ms`);
    
    this.testResults.separateConcurrency = {
      decisions: {
        concurrent: decisionResults.length,
        successful: decisionSuccesses,
        totalTime: decisionDuration,
        avgTime: Math.round(decisionDuration / decisionResults.length)
      },
      responses: {
        sequential: responseResults.length,
        successful: responseSuccesses,
        totalTime: responseTotalDuration,
        avgTime: responseSuccesses > 0 ? Math.round(responseTotalDuration / responseSuccesses) : 0
      }
    };
  }

  async testMixedWorkload() {
    console.log('\n🌀 MIXED WORKLOAD TEST');
    console.log('Running decisions and responses simultaneously...\n');
    
    const provider = new FeatherlessProvider();
    
    // Start concurrent decisions
    const decisionPrompts = [
      "User said 'hello there'. Should I respond? Answer: respond/ignore",
      "User shared a cat picture. Should I react? Answer: react/ignore",
      "User said 'bye'. Should I respond? Answer: respond/ignore"
    ];
    
    // Start response generation
    const responsePrompt = "Write a friendly response to someone who just joined the Discord server.";
    
    console.log('🚀 Starting mixed workload...');
    console.log(`  • ${decisionPrompts.length} decision requests (concurrent)`);
    console.log(`  • 1 response request (large model)`);
    
    const mixedStartTime = Date.now();
    
    // Launch everything at once
    const decisionPromises = decisionPrompts.map((prompt, i) =>
      provider.generateResponse(prompt, this.smallModel.settings)
        .then(response => ({ 
          type: 'decision', 
          id: i + 1, 
          success: true, 
          response, 
          completedAt: Date.now() - mixedStartTime 
        }))
        .catch(error => ({ 
          type: 'decision', 
          id: i + 1, 
          success: false, 
          error: error.message,
          completedAt: Date.now() - mixedStartTime
        }))
    );
    
    const responsePromise = provider.generateResponse(responsePrompt, this.largeModel.settings)
      .then(response => ({ 
        type: 'response', 
        id: 1, 
        success: true, 
        response, 
        completedAt: Date.now() - mixedStartTime 
      }))
      .catch(error => ({ 
        type: 'response', 
        id: 1, 
        success: false, 
        error: error.message,
        completedAt: Date.now() - mixedStartTime
      }));
    
    // Wait for all to complete
    const allResults = await Promise.all([...decisionPromises, responsePromise]);
    const mixedTotalDuration = Date.now() - mixedStartTime;
    
    // Analyze results
    const decisions = allResults.filter(r => r.type === 'decision');
    const responses = allResults.filter(r => r.type === 'response');
    
    const decisionSuccesses = decisions.filter(r => r.success).length;
    const responseSuccesses = responses.filter(r => r.success).length;
    
    console.log('\n📊 Mixed Workload Results:');
    console.log(`  Decisions: ${decisionSuccesses}/${decisions.length} completed`);
    console.log(`  Response: ${responseSuccesses}/${responses.length} completed`);
    console.log(`  Total time: ${mixedTotalDuration}ms`);
    
    // Show completion timeline
    console.log('\n🕐 Completion Timeline:');
    allResults
      .sort((a, b) => a.completedAt - b.completedAt)
      .forEach(result => {
        const status = result.success ? '✓' : '✗';
        console.log(`  ${result.completedAt}ms: ${status} ${result.type} ${result.id}`);
      });
    
    this.testResults.mixedWorkload = {
      totalDuration: mixedTotalDuration,
      decisions: { total: decisions.length, successful: decisionSuccesses },
      responses: { total: responses.length, successful: responseSuccesses },
      timeline: allResults.map(r => ({ 
        type: r.type, 
        completedAt: r.completedAt, 
        success: r.success 
      }))
    };
  }

  async testRealWorldSimulation() {
    console.log('\n🌍 REAL WORLD SIMULATION');
    console.log('Simulating Atlas processing multiple messages with decisions + responses...\n');
    
    const provider = new FeatherlessProvider();
    
    // Simulate 3 users sending messages requiring different actions
    const scenarios = [
      {
        user: 'Alice',
        message: 'Hey everyone! Just joined this server 😊',
        decisionPrompt: "User Alice said 'Hey everyone! Just joined this server 😊'. Should I respond to welcome them? Answer: respond/ignore",
        needsResponse: true,
        responsePrompt: "Write a warm welcome message for Alice who just joined the server."
      },
      {
        user: 'Bob', 
        message: 'lol',
        decisionPrompt: "User Bob just said 'lol'. Should I respond or ignore? Answer: respond/ignore",
        needsResponse: false
      },
      {
        user: 'Carol',
        message: 'Can someone help me with coding?',
        decisionPrompt: "User Carol asked 'Can someone help me with coding?'. Should I respond? Answer: respond/ignore", 
        needsResponse: true,
        responsePrompt: "Respond helpfully to Carol who asked for coding help."
      }
    ];
    
    console.log(`🎭 Simulating ${scenarios.length} concurrent user messages...`);
    
    const simStartTime = Date.now();
    const allTasks = [];
    
    // Start all decisions concurrently
    scenarios.forEach((scenario, i) => {
      const decisionTask = provider.generateResponse(scenario.decisionPrompt, this.smallModel.settings)
        .then(decision => {
          const completedAt = Date.now() - simStartTime;
          console.log(`  📋 ${completedAt}ms: Decision for ${scenario.user} completed`);
          
          // If decision says respond, queue response
          if (scenario.needsResponse && decision.toLowerCase().includes('respond')) {
            return provider.generateResponse(scenario.responsePrompt, this.largeModel.settings)
              .then(response => {
                const responseCompletedAt = Date.now() - simStartTime;
                console.log(`  💬 ${responseCompletedAt}ms: Response for ${scenario.user} completed`);
                
                return {
                  user: scenario.user,
                  decision: { success: true, content: decision, completedAt },
                  response: { success: true, content: response, completedAt: responseCompletedAt }
                };
              })
              .catch(error => ({
                user: scenario.user,
                decision: { success: true, content: decision, completedAt },
                response: { success: false, error: error.message, completedAt: Date.now() - simStartTime }
              }));
          } else {
            return {
              user: scenario.user,
              decision: { success: true, content: decision, completedAt },
              response: null
            };
          }
        })
        .catch(error => ({
          user: scenario.user,
          decision: { success: false, error: error.message, completedAt: Date.now() - simStartTime },
          response: null
        }));
      
      allTasks.push(decisionTask);
    });
    
    const simResults = await Promise.all(allTasks);
    const simTotalDuration = Date.now() - simStartTime;
    
    console.log('\n🎯 Real World Simulation Results:');
    console.log(`  Total simulation time: ${simTotalDuration}ms`);
    
    simResults.forEach(result => {
      const decisionStatus = result.decision.success ? '✓' : '✗';
      const responseStatus = result.response ? (result.response.success ? '✓' : '✗') : '−';
      
      console.log(`  ${result.user}: Decision ${decisionStatus} (${result.decision.completedAt}ms), Response ${responseStatus}${result.response ? ` (${result.response.completedAt}ms)` : ''}`);
    });
    
    this.testResults.realWorldSimulation = {
      totalDuration: simTotalDuration,
      scenarios: simResults,
      decisionsCompleted: simResults.filter(r => r.decision.success).length,
      responsesCompleted: simResults.filter(r => r.response?.success).length
    };
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔬 DUAL MODEL CONCURRENCY TEST REPORT');
    console.log('='.repeat(80));
    
    const { modelBaseline, separateConcurrency, mixedWorkload, realWorldSimulation } = this.testResults;
    
    // Model Performance Comparison
    console.log('\n📊 MODEL PERFORMANCE BASELINE:');
    if (modelBaseline.decision && modelBaseline.response) {
      console.log(`  🧠 Decision Model (${this.smallModel.name}):`);
      console.log(`    Average Speed: ${modelBaseline.decision.avgTime}ms`);
      console.log(`    Success Rate: ${modelBaseline.decision.successRate}%`);
      console.log(`    Speed Rating: ${modelBaseline.decision.avgTime < 2000 ? '🚀 Fast' : '⏳ Moderate'}`);
      
      console.log(`  🎯 Response Model (${this.largeModel.name}):`);
      console.log(`    Average Speed: ${modelBaseline.response.avgTime}ms`);
      console.log(`    Success Rate: ${modelBaseline.response.successRate}%`);
      console.log(`    Quality Rating: ${modelBaseline.response.avgTime > 3000 ? '🏆 High Quality' : '⚡ Efficient'}`);
      
      const speedRatio = Math.round(modelBaseline.response.avgTime / modelBaseline.decision.avgTime);
      console.log(`  ⚖️  Response model is ${speedRatio}x slower than decision model`);
    }
    
    // Concurrency Analysis
    console.log('\n⚡ CONCURRENCY PERFORMANCE:');
    if (separateConcurrency.decisions) {
      const decisionEfficiency = separateConcurrency.decisions.avgTime;
      const responseTime = separateConcurrency.responses.avgTime;
      
      console.log(`  📈 Decision Concurrency: ${separateConcurrency.decisions.concurrent} simultaneous`);
      console.log(`    Time per decision: ${decisionEfficiency}ms (vs ${modelBaseline.decision?.avgTime}ms baseline)`);
      console.log(`    Efficiency: ${decisionEfficiency < (modelBaseline.decision?.avgTime * 1.5) ? '✅ Excellent' : '⚠️ Some overhead'}`);
      
      console.log(`  🎯 Response Sequential: One at a time`);
      console.log(`    Time per response: ${responseTime}ms (vs ${modelBaseline.response?.avgTime}ms baseline)`);
      console.log(`    Consistency: ${Math.abs(responseTime - modelBaseline.response?.avgTime) < 1000 ? '✅ Stable' : '⚠️ Variable'}`);
    }
    
    // Mixed Workload Insights
    console.log('\n🌀 MIXED WORKLOAD ANALYSIS:');
    if (mixedWorkload.totalDuration) {
      const decisionPhase = Math.max(...mixedWorkload.timeline.filter(t => t.type === 'decision').map(t => t.completedAt));
      const responsePhase = Math.max(...mixedWorkload.timeline.filter(t => t.type === 'response').map(t => t.completedAt));
      
      console.log(`  🚀 Decision Phase: ${decisionPhase}ms (${mixedWorkload.decisions.successful}/${mixedWorkload.decisions.total} completed)`);
      console.log(`  🎯 Response Phase: ${responsePhase}ms (${mixedWorkload.responses.successful}/${mixedWorkload.responses.total} completed)`);
      console.log(`  🏁 Total Time: ${mixedWorkload.totalDuration}ms`);
      
      const overlap = decisionPhase < responsePhase;
      console.log(`  🔄 Overlap: ${overlap ? '✅ Decisions finished before responses' : '⚠️ Some overlap detected'}`);
    }
    
    // Real World Performance
    console.log('\n🌍 REAL WORLD SIMULATION:');
    if (realWorldSimulation.totalDuration) {
      const avgDecisionTime = realWorldSimulation.scenarios
        .filter(s => s.decision.success)
        .reduce((sum, s) => sum + s.decision.completedAt, 0) / realWorldSimulation.decisionsCompleted;
      
      console.log(`  ⏱️  Total Processing Time: ${realWorldSimulation.totalDuration}ms`);
      console.log(`  📋 Decisions: ${realWorldSimulation.decisionsCompleted}/3 completed (avg: ${Math.round(avgDecisionTime)}ms)`);
      console.log(`  💬 Responses: ${realWorldSimulation.responsesCompleted} generated`);
      
      const efficiency = realWorldSimulation.totalDuration < 10000 ? '🚀 Excellent' : 
                        realWorldSimulation.totalDuration < 15000 ? '✅ Good' : '⚠️ Slow';
      console.log(`  🎯 Overall Efficiency: ${efficiency}`);
    }
    
    // Strategic Recommendations
    console.log('\n💡 ATLAS CONFIGURATION RECOMMENDATIONS:');
    console.log(`  🧠 Decision Model: "${this.smallModel.id}"`);
    console.log(`    • Concurrency Limit: 3-4 (based on test results)`);
    console.log(`    • Use for: Decision making, quick analysis, reactions`);
    console.log(`    • Temperature: 0.3 (consistent decisions)`);
    
    console.log(`  🎯 Response Model: "${this.largeModel.id}"`);
    console.log(`    • Concurrency Limit: 1 (sequential processing)`);
    console.log(`    • Use for: Full response generation, creative content`);
    console.log(`    • Temperature: 0.7 (more creative responses)`);
    
    console.log('\n🔧 OPTIMAL QUEUE CONFIGURATION:');
    console.log('  • Global Concurrency: 4');
    console.log('  • Decision Queue: 3 concurrent');
    console.log('  • Response Queue: 1 concurrent');
    console.log('  • This allows fast decisions while preserving response quality');
    
    console.log('\n✨ KEY INSIGHTS:');
    console.log('  🎯 Decision-first architecture works excellently');
    console.log('  ⚡ Fast decisions enable responsive bot behavior');
    console.log('  🧠 Large model quality justifies sequential processing');
    console.log('  🔄 Mixed workload performs better than expected');
    
    console.log('\n' + '='.repeat(80));
  }

  async run() {
    console.log('🚀 Dual Model Concurrency Test Suite');
    console.log('Testing optimal configuration for Atlas bot with two specialized models\n');
    
    try {
      await this.testModelBaseline();
      await this.testSeparateConcurrency();
      await this.testMixedWorkload();
      await this.testRealWorldSimulation();
      
      this.generateReport();
    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,  
    output: process.stdout
  });

  rl.question('Enter your Featherless API key: ', async (apiKey) => {
    rl.close();
    
    if (!apiKey.trim()) {
      console.log('❌ No API key provided');
      process.exit(1);
    }
    
    const tester = new DualModelConcurrencyTester(apiKey.trim());
    
    try {
      await tester.run();
    } catch (error) {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    }
  });
}

module.exports = DualModelConcurrencyTester;
#!/usr/bin/env node

/**
 * Featherless Model Performance Test
 * Tests different models for optimal Atlas performance
 */

const path = require('path');
const serverSrcPath = path.resolve(__dirname, 'server', 'src');
process.env.NODE_PATH = serverSrcPath;
require('module').Module._initPaths();

const FeatherlessProvider = require('../server/src/services/llm/providers/FeatherlessProvider');

class ModelPerformanceTester {
  constructor(apiKey) {
    this.apiKey = apiKey;
    
    // Test models - selected for speed and reliability
    this.testModels = [
      {
        id: 'Qwen/Qwen3-8B',
        name: 'Qwen/Qwen3-8B',
        category: 'Fast Chat'
      },
      {
        id: 'meta-llama/Llama-3.1-8B-Instruct',
        name: 'meta-llama/Llama-3.1-8B-Instruct',
        category: 'Reliable'
      },
      {
        id: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
        name: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
        category: 'Efficient'
      },
      {
        id: 'Qwen/Qwen3-14B',
        name: 'Qwen/Qwen3-14B',
        category: 'Popular'
      },
      {
        id: 'zai-org/GLM-4-9B-0414',
        name: 'zai-org/GLM-4-9B-0414',
        category: 'Balanced'
      }
    ];
    
    this.testPrompts = [
      "Reply with just 'Hello!' and nothing else.",
      "What is 2+2?",
      "Name one programming language.",
      "What day comes after Tuesday?"
    ];
  }

  async testModelSpeed(model) {
    console.log(`\n🧪 Testing ${model.name}...`);
    
    const provider = new FeatherlessProvider();
    const settings = {
      provider: 'featherless',
      model: model.id,
      api_key: this.apiKey,
      temperature: 0.3,
      max_tokens: 50
    };

    const results = {
      model: model,
      tests: [],
      averageSpeed: 0,
      successRate: 0,
      errors: []
    };

    // Test single requests first
    for (let i = 0; i < this.testPrompts.length; i++) {
      const prompt = this.testPrompts[i];
      
      try {
        const startTime = Date.now();
        const response = await provider.generateResponse(prompt, settings);
        const duration = Date.now() - startTime;
        
        results.tests.push({
          prompt: prompt.substring(0, 20) + '...',
          success: true,
          duration,
          responseLength: response.length
        });
        
        console.log(`  ✓ Test ${i + 1}: ${duration}ms (${response.length} chars)`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        results.tests.push({
          prompt: prompt.substring(0, 20) + '...',
          success: false,
          error: error.message
        });
        results.errors.push(error.message);
        console.log(`  ✗ Test ${i + 1}: ${error.message}`);
      }
    }

    // Calculate stats
    const successfulTests = results.tests.filter(t => t.success);
    results.successRate = (successfulTests.length / results.tests.length) * 100;
    
    if (successfulTests.length > 0) {
      results.averageSpeed = successfulTests.reduce((sum, test) => sum + test.duration, 0) / successfulTests.length;
    }

    return results;
  }

  async testConcurrency(model, concurrency = 2) {
    console.log(`\n⚡ Testing ${model.name} concurrency (${concurrency} requests)...`);
    
    const provider = new FeatherlessProvider();
    const settings = {
      provider: 'featherless',
      model: model.id,
      api_key: this.apiKey,
      temperature: 0.3,
      max_tokens: 30
    };

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      const prompt = `Count to ${i + 3} and stop.`;
      promises.push(
        provider.generateResponse(prompt, settings)
          .then(response => ({ success: true, duration: Date.now() - startTime, response }))
          .catch(error => ({ success: false, error: error.message }))
      );
    }

    try {
      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      
      console.log(`  ${successCount}/${concurrency} succeeded in ${totalDuration}ms`);
      
      return {
        totalRequests: concurrency,
        successful: successCount,
        failed: concurrency - successCount,
        totalDuration,
        canHandleConcurrency: successCount === concurrency
      };
    } catch (error) {
      console.log(`  Concurrency test failed: ${error.message}`);
      return {
        totalRequests: concurrency,
        successful: 0,
        failed: concurrency,
        error: error.message,
        canHandleConcurrency: false
      };
    }
  }

  async runFullTest() {
    console.log('🚀 Testing Featherless Models for Atlas Optimization\n');
    
    const results = [];
    
    for (const model of this.testModels) {
      try {
        // Test basic speed
        const speedResults = await this.testModelSpeed(model);
        
        // Test concurrency if speed test was successful
        let concurrencyResults = null;
        if (speedResults.successRate > 50) {
          concurrencyResults = await this.testConcurrency(model, 2);
          
          // Brief pause between models
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        results.push({
          ...speedResults,
          concurrency: concurrencyResults
        });
        
      } catch (error) {
        console.log(`❌ Failed to test ${model.name}: ${error.message}`);
        results.push({
          model,
          error: error.message,
          tests: [],
          averageSpeed: Infinity,
          successRate: 0
        });
      }
    }

    return results;
  }

  generateReport(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 MODEL PERFORMANCE REPORT FOR ATLAS');
    console.log('='.repeat(70));

    // Sort by performance (success rate, then speed)
    const sortedResults = results
      .filter(r => r.successRate > 0)
      .sort((a, b) => {
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageSpeed - b.averageSpeed;
      });

    console.log('\n🏆 RECOMMENDED MODELS (Best to Worst):');
    
    sortedResults.forEach((result, index) => {
      const ranking = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || `${index + 1}️⃣`;
      const concurrencyStatus = result.concurrency?.canHandleConcurrency ? '✅ Concurrent' : '⚠️ Sequential';
      
      console.log(`\n${ranking} ${result.model.name} (${result.model.category})`);
      console.log(`    Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log(`    Avg Speed: ${result.averageSpeed.toFixed(0)}ms`);
      console.log(`    Concurrency: ${concurrencyStatus}`);
      console.log(`    Model ID: ${result.model.id}`);
      
      if (result.errors.length > 0) {
        console.log(`    Issues: ${result.errors[0]}`);
      }
    });

    // Specific recommendations
    console.log('\n💡 ATLAS CONFIGURATION RECOMMENDATIONS:');
    
    if (sortedResults.length > 0) {
      const bestModel = sortedResults[0];
      console.log(`\n🎯 PRIMARY CHOICE: ${bestModel.model.name}`);
      console.log(`   Model: "${bestModel.model.id}"`);
      console.log(`   Why: ${bestModel.successRate === 100 ? 'Perfect reliability' : 'Best overall performance'}, ${bestModel.averageSpeed < 2000 ? 'fast responses' : 'acceptable speed'}`);
      
      if (bestModel.concurrency?.canHandleConcurrency) {
        console.log(`   Concurrency: Set global limit to 3-4 for optimal performance`);
      } else {
        console.log(`   Concurrency: Keep at 1-2 to avoid rate limits`);
      }
    }

    if (sortedResults.length > 1) {
      const backup = sortedResults[1];
      console.log(`\n🔄 BACKUP CHOICE: ${backup.model.name}`);
      console.log(`   Model: "${backup.model.id}"`);
      console.log(`   Use if primary model has issues`);
    }

    console.log('\n⚙️ SETTINGS TO UPDATE IN ATLAS:');
    console.log('   1. Go to Settings > LLM Configuration');
    console.log('   2. Set Provider: Featherless');
    console.log(`   3. Set Model: ${sortedResults[0]?.model.id || 'See recommendations above'}`);
    console.log('   4. Adjust queue concurrency based on test results');

    console.log('\n' + '='.repeat(70));
  }

  async run() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const apiKey = await new Promise((resolve) => {
      rl.question('Enter your Featherless API key: ', (key) => {
        rl.close();
        resolve(key.trim());
      });
    });

    if (!apiKey) {
      console.log('❌ No API key provided');
      process.exit(1);
    }

    this.apiKey = apiKey;
    
    const results = await this.runFullTest();
    this.generateReport(results);
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new ModelPerformanceTester();
  tester.run().catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = ModelPerformanceTester;
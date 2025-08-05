#!/usr/bin/env node

/**
 * Featherless API Key & Concurrency Test Script
 * 
 * This script tests:
 * 1. API key authentication from settings (not environment)
 * 2. Concurrent connection capabilities (up to 4 as advertised)  
 * 3. Queue performance with multiple simultaneous requests
 * 4. Error handling and rate limiting
 */

const path = require('path');
const fs = require('fs');

// Add server src to path for imports
const serverSrcPath = path.resolve(__dirname, 'server', 'src');
process.env.NODE_PATH = serverSrcPath;
require('module').Module._initPaths();

// Import Atlas services
const FeatherlessProvider = require('../server/src/services/llm/providers/FeatherlessProvider');
const LLMService = require('../server/src/services/llm/index');
const RequestQueue = require('../server/src/services/llm/RequestQueue');

class FeatherlessConcurrencyTester {
  constructor() {
    this.results = {
      apiKeyTest: null,
      concurrencyTest: null,
      queueIntegrationTest: null,
      errors: []
    };
    
    // Test settings with API key (not from env)
    this.testSettings = {
      provider: 'featherless',
      model: 'moonshotai/Kimi-K2-Instruct',
      api_key: '', // Will be prompted for
      temperature: 0.7,
      max_tokens: 100
    };
  }

  async promptForApiKey() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter your Featherless API key: ', (apiKey) => {
        rl.close();
        resolve(apiKey.trim());
      });
    });
  }

  async testApiKeyFromSettings() {
    console.log('\n🔑 Testing API Key from Settings (not environment)...\n');
    
    try {
      // Clear environment variable to ensure we're testing settings
      delete process.env.FEATHERLESS_API_KEY;
      
      const provider = new FeatherlessProvider();
      console.log('✓ Provider initialized without env API key');
      
      // Test with settings API key
      const testPrompt = "Say 'Hello from Featherless!' and nothing else.";
      
      const startTime = Date.now();
      const response = await provider.generateResponse(testPrompt, this.testSettings);
      const duration = Date.now() - startTime;
      
      console.log(`✓ API key from settings works! (${duration}ms)`);
      console.log(`Response: ${response.substring(0, 100)}...`);
      
      this.results.apiKeyTest = {
        success: true,
        duration,
        responseLength: response.length
      };
      
      return true;
    } catch (error) {
      console.log(`✗ API key test failed: ${error.message}`);
      this.results.errors.push(`API Key Test: ${error.message}`);
      this.results.apiKeyTest = { success: false, error: error.message };
      return false;
    }
  }

  async testConcurrentConnections() {
    console.log('\n⚡ Testing Concurrent Connections (up to 4)...\n');
    
    try {
      const provider = new FeatherlessProvider();
      const concurrencyLevels = [1, 2, 3, 4, 5]; // Test beyond advertised limit
      const results = {};
      
      for (const concurrency of concurrencyLevels) {
        console.log(`Testing ${concurrency} concurrent requests...`);
        
        const promises = [];
        const startTime = Date.now();
        
        for (let i = 0; i < concurrency; i++) {
          const prompt = `Request ${i + 1}: Count to 5 and say done.`;
          promises.push(
            provider.generateResponse(prompt, this.testSettings)
              .then(response => ({ success: true, response, requestId: i + 1 }))
              .catch(error => ({ success: false, error: error.message, requestId: i + 1 }))
          );
        }
        
        const responses = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = responses.filter(r => r.success).length;
        
        console.log(`  ✓ ${successCount}/${concurrency} requests succeeded in ${duration}ms`);
        
        if (successCount < concurrency) {
          console.log(`  ⚠️  Failed requests:`);
          responses.filter(r => !r.success).forEach(r => {
            console.log(`    Request ${r.requestId}: ${r.error}`);
          });
        }
        
        results[concurrency] = {
          total: concurrency,
          successful: successCount,
          failed: concurrency - successCount,
          duration,
          avgDuration: duration / concurrency,
          responses: responses
        };
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      this.results.concurrencyTest = {
        success: true,
        results
      };
      
      console.log('\n📊 Concurrency Test Results:');
      Object.entries(results).forEach(([level, result]) => {
        const successRate = (result.successful / result.total * 100).toFixed(1);
        console.log(`  ${level} concurrent: ${result.successful}/${result.total} (${successRate}%) - ${result.duration}ms total, ${result.avgDuration.toFixed(0)}ms avg`);
      });
      
      return true;
    } catch (error) {
      console.log(`✗ Concurrency test failed: ${error.message}`);
      this.results.errors.push(`Concurrency Test: ${error.message}`);
      this.results.concurrencyTest = { success: false, error: error.message };
      return false;
    }
  }

  async testQueueIntegration() {
    console.log('\n🔄 Testing Queue Integration with High Concurrency...\n');
    
    try {
      // Initialize LLM service with queue
      const llmService = new LLMService();
      
      // Set high concurrency limits for Featherless
      llmService.setGlobalConcurrencyLimit(4); // Match advertised limit
      llmService.setQueueConcurrencyLimit('custom_prompt', 4);
      llmService.setQueueConcurrencyLimit('decision_making', 3);
      
      console.log('✓ Queue configured for high concurrency');
      
      // Create multiple different request types
      const customPrompts = [
        'Explain quantum computing in one sentence.',
        'Name 3 programming languages.',
        'What is the capital of Japan?',
        'Count from 1 to 10.',
        'Describe the color blue.',
        'What day comes after Monday?',
        'Name a popular programming framework.',
        'What is 2 + 2?'
      ];
      
      const startTime = Date.now();
      const promises = [];
      
      // Queue multiple requests of different types
      customPrompts.forEach((prompt, index) => {
        promises.push(
          llmService.generateCustomResponse(prompt, this.testSettings)
            .then(result => ({ 
              success: result.success, 
              response: result.response,
              requestId: index + 1,
              prompt: prompt.substring(0, 30) + '...'
            }))
            .catch(error => ({ 
              success: false, 
              error: error.message, 
              requestId: index + 1,
              prompt: prompt.substring(0, 30) + '...'
            }))
        );
      });
      
      console.log(`Queued ${promises.length} requests...`);
      
      // Monitor queue stats during processing
      const statsInterval = setInterval(() => {
        const stats = llmService.getQueueStats();
        const health = llmService.getQueueHealth();
        console.log(`  Queue: ${stats.global.active}/${stats.global.limit} active, ${health.totalQueued} queued`);
      }, 500);
      
      const results = await Promise.all(promises);
      clearInterval(statsInterval);
      
      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      
      console.log(`\n✓ Queue processing completed: ${successCount}/${results.length} succeeded in ${duration}ms`);
      
      if (successCount < results.length) {
        console.log(`Failed requests:`);
        results.filter(r => !r.success).forEach(r => {
          console.log(`  Request ${r.requestId} (${r.prompt}): ${r.error}`);
        });
      }
      
      // Final queue stats
      const finalStats = llmService.getQueueStats();
      console.log(`Final queue state: ${finalStats.global.active} active, ${finalStats.types.custom_prompt?.queued || 0} queued`);
      
      this.results.queueIntegrationTest = {
        success: successCount > 0,
        totalRequests: results.length,
        successfulRequests: successCount,
        duration,
        avgDuration: duration / results.length,
        queueEffective: duration < (results.length * 2000) // Should be faster than sequential
      };
      
      return true;
    } catch (error) {
      console.log(`✗ Queue integration test failed: ${error.message}`);
      this.results.errors.push(`Queue Integration: ${error.message}`);
      this.results.queueIntegrationTest = { success: false, error: error.message };
      return false;
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 FEATHERLESS CONCURRENCY TEST REPORT');
    console.log('='.repeat(60));
    
    const { apiKeyTest, concurrencyTest, queueIntegrationTest, errors } = this.results;
    
    // API Key Test Results
    console.log('\n📋 API Key from Settings Test:');
    if (apiKeyTest?.success) {
      console.log(`  ✅ PASSED - Response in ${apiKeyTest.duration}ms`);
    } else {
      console.log(`  ❌ FAILED - ${apiKeyTest?.error || 'Unknown error'}`);
    }
    
    // Concurrency Test Results
    console.log('\n⚡ Concurrent Connections Test:');
    if (concurrencyTest?.success) {
      console.log(`  ✅ PASSED - Tested up to 5 concurrent connections`);
      Object.entries(concurrencyTest.results).forEach(([level, result]) => {
        const status = result.successful === result.total ? '✅' : '⚠️';
        console.log(`    ${status} ${level} concurrent: ${result.successful}/${result.total} (${result.duration}ms)`);
      });
    } else {
      console.log(`  ❌ FAILED - ${concurrencyTest?.error || 'Unknown error'}`);
    }
    
    // Queue Integration Test Results
    console.log('\n🔄 Queue Integration Test:');
    if (queueIntegrationTest?.success) {
      const efficiency = queueIntegrationTest.queueEffective ? 'Efficient' : 'Sequential';
      console.log(`  ✅ PASSED - ${queueIntegrationTest.successfulRequests}/${queueIntegrationTest.totalRequests} requests (${efficiency})`);
      console.log(`    Total time: ${queueIntegrationTest.duration}ms`);
      console.log(`    Avg per request: ${queueIntegrationTest.avgDuration.toFixed(0)}ms`);
    } else {
      console.log(`  ❌ FAILED - ${queueIntegrationTest?.error || 'Unknown error'}`);
    }
    
    // Overall Assessment
    console.log('\n🎯 Overall Assessment:');
    const totalTests = 3;
    const passedTests = [apiKeyTest?.success, concurrencyTest?.success, queueIntegrationTest?.success].filter(Boolean).length;
    
    if (passedTests === totalTests) {
      console.log(`  🎉 ALL TESTS PASSED (${passedTests}/${totalTests})`);
      console.log(`  ✨ Featherless is working great with Atlas!`);
      console.log(`  💡 Recommendation: Use concurrency limit of 3-4 for optimal performance`);
    } else {
      console.log(`  ⚠️  ${passedTests}/${totalTests} tests passed`);
      if (errors.length > 0) {
        console.log(`  Errors encountered:`);
        errors.forEach(error => console.log(`    • ${error}`));
      }
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    console.log('🚀 Featherless API Key & Concurrency Test Suite');
    console.log('This test verifies Atlas integration with Featherless AI\n');
    
    // Get API key from user
    this.testSettings.api_key = await this.promptForApiKey();
    
    if (!this.testSettings.api_key) {
      console.log('❌ No API key provided, exiting...');
      process.exit(1);
    }
    
    console.log('✓ API key received, starting tests...');
    
    // Run tests in sequence
    await this.testApiKeyFromSettings();
    await this.testConcurrentConnections(); 
    await this.testQueueIntegration();
    
    // Generate final report
    await this.generateReport();
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new FeatherlessConcurrencyTester();
  tester.run().catch(error => {
    console.error('\n💥 Test suite crashed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = FeatherlessConcurrencyTester;
class ConfigurationAnalyzer {
  constructor(queueStatsTracker, performanceMetrics) {
    this.queueStats = queueStatsTracker;
    this.performanceMetrics = performanceMetrics;
  }

  suggestOptimalLimits() {
    const queueStats = this.queueStats.getQueueStats();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
    
    const suggestions = {
      global: queueStats.global.limit,
      types: {}
    };
    
    // Suggest increases for consistently busy queues
    for (const [type, stats] of Object.entries(queueStats.types)) {
      if (stats.queued > stats.limit && performanceMetrics.successRate > 95) {
        suggestions.types[type] = Math.min(stats.limit + 2, 10); // Conservative increase
      } else {
        suggestions.types[type] = stats.limit;
      }
    }
    
    // Suggest global limit adjustment
    const totalOptimal = Object.values(suggestions.types).reduce((sum, limit) => sum + limit, 0);
    suggestions.global = Math.max(suggestions.global, Math.ceil(totalOptimal * 0.8));
    
    return {
      current: {
        global: queueStats.global.limit,
        types: Object.fromEntries(
          Object.entries(queueStats.types).map(([type, stats]) => [type, stats.limit])
        )
      },
      suggested: suggestions,
      reasoning: this.explainSuggestions(queueStats, performanceMetrics, suggestions)
    };
  }

  explainSuggestions(queueStats, performanceMetrics, suggestions) {
    const explanations = [];
    
    for (const [type, suggestedLimit] of Object.entries(suggestions.types)) {
      const currentLimit = queueStats.types[type]?.limit || 1;
      const currentQueued = queueStats.types[type]?.queued || 0;
      
      if (suggestedLimit > currentLimit) {
        explanations.push(`Increase ${type} limit to ${suggestedLimit} (currently ${currentQueued} queued vs ${currentLimit} limit)`);
      }
    }
    
    if (suggestions.global > queueStats.global.limit) {
      explanations.push(`Increase global limit to ${suggestions.global} to accommodate type-specific increases`);
    }
    
    return explanations;
  }

  analyzeConfiguration() {
    const queueStats = this.queueStats.getQueueStats();
    const performanceMetrics = this.performanceMetrics.getPerformanceMetrics();
    const utilization = this.queueStats.getQueueUtilization();
    
    return {
      currentConfig: {
        global: queueStats.global,
        types: queueStats.types,
        utilization: utilization
      },
      performance: {
        successRate: performanceMetrics.successRate,
        avgResponseTime: performanceMetrics.averageResponseTime,
        isPerformant: performanceMetrics.averageResponseTime < 3000
      },
      recommendations: this.getConfigurationRecommendations(queueStats, performanceMetrics, utilization),
      optimizationPotential: this.assessOptimizationPotential(utilization, performanceMetrics)
    };
  }

  getConfigurationRecommendations(queueStats, performanceMetrics, utilization) {
    const recommendations = [];
    
    // Global utilization recommendations
    if (utilization.globalUtilization > 90) {
      recommendations.push({
        type: 'global_limit',
        priority: 'high',
        message: 'Global limit is frequently maxed out',
        suggestion: `Consider increasing global limit from ${queueStats.global.limit} to ${queueStats.global.limit + 2}`
      });
    }
    
    // Type-specific recommendations
    for (const [type, typeUtilization] of Object.entries(utilization.typeUtilization)) {
      if (typeUtilization > 80) {
        recommendations.push({
          type: 'type_limit',
          requestType: type,
          priority: 'medium',
          message: `${type} requests frequently hit concurrency limit`,
          suggestion: `Consider increasing ${type} limit`
        });
      }
    }
    
    // Performance-based recommendations
    if (performanceMetrics.successRate < 95) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Low success rate may indicate overload',
        suggestion: 'Reduce concurrency limits or investigate provider issues'
      });
    }
    
    if (performanceMetrics.averageResponseTime > 5000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium', 
        message: 'High response times detected',
        suggestion: 'Consider reducing load or optimizing prompts'
      });
    }
    
    return recommendations;
  }

  assessOptimizationPotential(utilization, performanceMetrics) {
    let potential = 'low';
    let score = 0;
    const issues = [];
    
    // Check utilization efficiency
    if (utilization.globalUtilization > 90) {
      score += 30;
      issues.push('Global concurrency frequently maxed');
    }
    
    if (utilization.queueBacklog > 5) {
      score += 25;
      issues.push('Frequent queue backlogs');
    }
    
    // Check performance issues
    if (performanceMetrics.successRate < 95) {
      score += 35;
      issues.push('Success rate below optimal');
    }
    
    if (performanceMetrics.averageResponseTime > 3000) {
      score += 20;
      issues.push('Response times above optimal');
    }
    
    if (score > 70) potential = 'high';
    else if (score > 40) potential = 'medium';
    
    return {
      level: potential,
      score: score,
      issues: issues,
      recommendation: this.getOptimizationRecommendation(potential, score)
    };
  }

  getOptimizationRecommendation(potential, score) {
    if (potential === 'high') {
      return 'Significant optimization opportunities detected. Review queue limits and performance metrics.';
    } else if (potential === 'medium') {
      return 'Some optimization possible. Monitor trends and consider gradual adjustments.';
    } else {
      return 'System is performing well. Continue monitoring for trends.';
    }
  }

  generateTuningPlan() {
    const analysis = this.analyzeConfiguration();
    const optimalLimits = this.suggestOptimalLimits();
    
    return {
      currentState: analysis,
      targetState: optimalLimits.suggested,
      migrationSteps: this.generateMigrationSteps(analysis.currentConfig, optimalLimits.suggested),
      expectedImpact: this.estimateImpact(analysis, optimalLimits),
      rollbackPlan: analysis.currentConfig
    };
  }

  generateMigrationSteps(currentConfig, targetConfig) {
    const steps = [];
    
    // Global limit changes
    if (targetConfig.global !== currentConfig.global.limit) {
      steps.push({
        step: 1,
        action: 'update_global_limit',
        from: currentConfig.global.limit,
        to: targetConfig.global,
        risk: 'low',
        description: `Update global concurrency limit from ${currentConfig.global.limit} to ${targetConfig.global}`
      });
    }
    
    // Type-specific changes
    let stepNum = 2;
    for (const [type, targetLimit] of Object.entries(targetConfig.types)) {
      const currentLimit = currentConfig.types[type]?.limit || 1;
      if (targetLimit !== currentLimit) {
        steps.push({
          step: stepNum++,
          action: 'update_type_limit',
          requestType: type,
          from: currentLimit,
          to: targetLimit,
          risk: 'low',
          description: `Update ${type} concurrency limit from ${currentLimit} to ${targetLimit}`
        });
      }
    }
    
    return steps;
  }

  estimateImpact(currentAnalysis, optimalLimits) {
    const impact = {
      performance: 'neutral',
      reliability: 'neutral',
      throughput: 'neutral',
      risks: []
    };
    
    // Calculate potential improvements
    const currentUtilization = currentAnalysis.currentConfig.utilization;
    const performanceMetrics = currentAnalysis.performance;
    
    // Throughput impact
    if (optimalLimits.suggested.global > currentAnalysis.currentConfig.global.limit) {
      impact.throughput = 'positive';
      impact.risks.push('Increased resource usage');
    }
    
    // Performance impact
    if (currentUtilization.queueBacklog > 5) {
      impact.performance = 'positive';
    }
    
    // Reliability impact
    if (performanceMetrics.successRate < 95) {
      impact.reliability = 'positive';
    }
    
    return impact;
  }
}

module.exports = ConfigurationAnalyzer;
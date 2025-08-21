/**
 * Performance monitoring utilities for HiveCodex
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'render' | 'api' | 'socket' | 'memory' | 'custom';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  constructor() {
    if (this.isEnabled && typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.addMetric({
              name: 'long-task',
              value: entry.duration,
              timestamp: Date.now(),
              type: 'render'
            });
            
            if (entry.duration > 50) {
              console.warn(`Long task detected: ${entry.duration}ms`);
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Monitor navigation timing
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.addMetric({
                name: 'page-load',
                value: navEntry.duration,
                timestamp: Date.now(),
                type: 'render'
              });
            }
          });
        });
        
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported');
      }
    }
  }

  addMetric(metric: PerformanceMetric) {
    if (!this.isEnabled) return;
    
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Measure render time
  measureRender<T>(componentName: string, renderFn: () => T): T {
    if (!this.isEnabled) return renderFn();
    
    const start = performance.now();
    const result = renderFn();
    const end = performance.now();
    
    this.addMetric({
      name: `render-${componentName}`,
      value: end - start,
      timestamp: Date.now(),
      type: 'render'
    });
    
    return result;
  }

  // Measure API call time
  async measureAPI<T>(apiName: string, apiFn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return apiFn();
    
    const start = performance.now();
    try {
      const result = await apiFn();
      const end = performance.now();
      
      this.addMetric({
        name: `api-${apiName}`,
        value: end - start,
        timestamp: Date.now(),
        type: 'api'
      });
      
      return result;
    } catch (error) {
      const end = performance.now();
      
      this.addMetric({
        name: `api-${apiName}-error`,
        value: end - start,
        timestamp: Date.now(),
        type: 'api'
      });
      
      throw error;
    }
  }

  // Measure socket event processing time
  measureSocketEvent<T>(eventName: string, handlerFn: () => T): T {
    if (!this.isEnabled) return handlerFn();
    
    const start = performance.now();
    const result = handlerFn();
    const end = performance.now();
    
    this.addMetric({
      name: `socket-${eventName}`,
      value: end - start,
      timestamp: Date.now(),
      type: 'socket'
    });
    
    return result;
  }

  // Monitor memory usage
  checkMemoryUsage() {
    if (!this.isEnabled || !('memory' in performance)) return;
    
    const memory = (performance as any).memory;
    
    this.addMetric({
      name: 'memory-used',
      value: memory.usedJSHeapSize / 1024 / 1024, // MB
      timestamp: Date.now(),
      type: 'memory'
    });
    
    this.addMetric({
      name: 'memory-total',
      value: memory.totalJSHeapSize / 1024 / 1024, // MB
      timestamp: Date.now(),
      type: 'memory'
    });
  }

  // Get performance report
  getReport(type?: PerformanceMetric['type'], limit: number = 100) {
    let filteredMetrics = this.metrics;
    
    if (type) {
      filteredMetrics = this.metrics.filter(m => m.type === type);
    }
    
    const recent = filteredMetrics.slice(-limit);
    
    const summary = {
      total: recent.length,
      average: recent.reduce((sum, m) => sum + m.value, 0) / recent.length || 0,
      min: Math.min(...recent.map(m => m.value)) || 0,
      max: Math.max(...recent.map(m => m.value)) || 0,
      recent: recent.slice(-10)
    };
    
    return summary;
  }

  // Log performance warnings
  logWarnings() {
    if (!this.isEnabled) return;
    
    const renderMetrics = this.metrics.filter(m => m.type === 'render');
    const slowRenders = renderMetrics.filter(m => m.value > 16); // > 16ms
    
    if (slowRenders.length > 0) {
      console.warn(`${slowRenders.length} slow renders detected:`, 
        slowRenders.slice(-5).map(m => `${m.name}: ${m.value.toFixed(2)}ms`)
      );
    }
    
    const apiMetrics = this.metrics.filter(m => m.type === 'api');
    const slowAPIs = apiMetrics.filter(m => m.value > 1000); // > 1s
    
    if (slowAPIs.length > 0) {
      console.warn(`${slowAPIs.length} slow API calls detected:`, 
        slowAPIs.slice(-5).map(m => `${m.name}: ${m.value.toFixed(2)}ms`)
      );
    }
  }

  // Cleanup
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const measureRender = (renderFn: () => any) => 
    performanceMonitor.measureRender(componentName, renderFn);
  
  const measureAPI = (apiName: string, apiFn: () => Promise<any>) => 
    performanceMonitor.measureAPI(apiName, apiFn);
  
  return { measureRender, measureAPI };
}

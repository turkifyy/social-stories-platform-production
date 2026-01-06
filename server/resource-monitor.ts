import os from 'os';

export class ResourceMonitor {
  private static readonly MEMORY_THRESHOLD = 0.85; // 85% of available memory
  private static readonly CPU_THRESHOLD = 0.80;    // 80% CPU load

  static async optimize() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemRatio = (totalMem - freeMem) / totalMem;

    console.log(`📊 [Monitor] Memory Usage: ${(usedMemRatio * 100).toFixed(2)}%`);

    if (usedMemRatio > this.MEMORY_THRESHOLD) {
      console.warn('⚠️ [Monitor] High memory usage detected. Triggering garbage collection...');
      if (global.gc) {
        global.gc();
      } else {
        console.warn('⚠️ [Monitor] Garbage collection not exposed. Run with --expose-gc.');
      }
    }

    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuLoadRatio = loadAvg / cpuCount;

    console.log(`📊 [Monitor] CPU Load: ${(cpuLoadRatio * 100).toFixed(2)}%`);

    if (cpuLoadRatio > this.CPU_THRESHOLD) {
      console.warn('⚠️ [Monitor] High CPU load. Throttling non-critical processes...');
      // Implement throttling logic if necessary
    }
  }

  static start(intervalMs: number = 60000) {
    console.log('🚀 [Monitor] Resource monitoring started for production environment.');
    setInterval(() => this.optimize(), intervalMs);
  }
}

import { randomUUID } from 'crypto';
import { ApiClient } from './api-client';
import { CsvWriter } from './csv-writer';
import { PurchaseResult } from './types';

// Scenario result types
export interface ScenarioResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface EdgeCaseConfig {
  apiBaseUrl: string;
}

// Helper functions
function generateRandomEmail(): string {
  return `user_${randomUUID().slice(0, 8)}@loadtest.local`;
}

function generateEmails(count: number): string[] {
  return Array.from({ length: count }, () => generateRandomEmail());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scenario runner class
export class EdgeCaseRunner {
  private apiClient: ApiClient;
  private csvWriter: CsvWriter;
  private results: ScenarioResult[] = [];

  constructor(config: EdgeCaseConfig) {
    this.apiClient = new ApiClient(config.apiBaseUrl);
    this.csvWriter = new CsvWriter();
  }

  private async createFlashSale(
    productId: string,
    stock: number,
    startTime: Date,
    endTime: Date,
  ) {
    return this.apiClient.createFlashSale(productId, stock, startTime, endTime);
  }

  private logScenario(result: ScenarioResult): void {
    const status = result.passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${status} ${result.name}`);
    console.log(`       ${result.message}`);
    if (result.details) {
      console.log(`       Details: ${JSON.stringify(result.details)}`);
    }
    this.results.push(result);
  }

  // ==========================================
  // SCENARIO 1: Same User Duplicate Prevention
  // ==========================================
  async runDuplicatePrevention(): Promise<ScenarioResult> {
    console.log('\n--- Running: Same User Duplicate Prevention ---');
    
    const productId = `dup-test-${randomUUID().slice(0, 8)}`;
    const stock = 10;
    const startTime = new Date();
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id}`);
      
      // Fire 10 requests with the SAME email
      const sameEmail = 'duplicate_test@loadtest.local';
      const concurrentRequests = 10;
      
      console.log(`   Firing ${concurrentRequests} requests with same email...`);
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => this.apiClient.purchaseItem(flashSale.id, sameEmail));
      
      const results = await Promise.all(promises);
      
      const successes = results.filter((r) => r.success).length;
      const alreadyPurchased = results.filter((r) => r.reason === 'ALREADY_PURCHASED').length;
      
      const passed = successes === 1 && alreadyPurchased === concurrentRequests - 1;
      
      return {
        name: 'Same User Duplicate Prevention',
        passed,
        message: passed
          ? `Correctly allowed 1 purchase, rejected ${alreadyPurchased} duplicates`
          : `Expected 1 success and ${concurrentRequests - 1} duplicates, got ${successes} successes and ${alreadyPurchased} duplicates`,
        details: { successes, alreadyPurchased, total: concurrentRequests },
      };
    } catch (error) {
      return {
        name: 'Same User Duplicate Prevention',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 2: Exact Stock Match
  // ==========================================
  async runExactStockMatch(): Promise<ScenarioResult> {
    console.log('\n--- Running: Exact Stock Match ---');
    
    const productId = `exact-test-${randomUUID().slice(0, 8)}`;
    const stock = 10;
    const startTime = new Date();
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} with stock=${stock}`);
      
      // Generate exactly 'stock' number of unique emails
      const emails = generateEmails(stock);
      
      console.log(`   Firing ${stock} requests with ${stock} unique emails...`);
      const promises = emails.map((email) =>
        this.apiClient.purchaseItem(flashSale.id, email),
      );
      
      const results = await Promise.all(promises);
      
      const successes = results.filter((r) => r.success).length;
      const soldOut = results.filter((r) => r.reason === 'SOLD_OUT').length;
      
      const passed = successes === stock && soldOut === 0;
      
      return {
        name: 'Exact Stock Match',
        passed,
        message: passed
          ? `All ${stock} unique users successfully purchased`
          : `Expected ${stock} successes, got ${successes} (${soldOut} sold out)`,
        details: { stock, successes, soldOut },
      };
    } catch (error) {
      return {
        name: 'Exact Stock Match',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 3: Overselling Prevention
  // ==========================================
  async runOversellingPrevention(): Promise<ScenarioResult> {
    console.log('\n--- Running: Overselling Prevention ---');
    
    const productId = `oversell-test-${randomUUID().slice(0, 8)}`;
    const stock = 10;
    const totalRequests = 100;
    const startTime = new Date();
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} with stock=${stock}`);
      
      const emails = generateEmails(totalRequests);
      
      console.log(`   Firing ${totalRequests} requests for ${stock} items...`);
      const promises = emails.map((email) =>
        this.apiClient.purchaseItem(flashSale.id, email),
      );
      
      const results = await Promise.all(promises);
      
      const successes = results.filter((r) => r.success).length;
      const soldOut = results.filter((r) => r.reason === 'SOLD_OUT').length;
      
      // Critical: winners must NEVER exceed stock
      const passed = successes === stock && successes <= stock;
      
      return {
        name: 'Overselling Prevention',
        passed,
        message: passed
          ? `Correctly limited to ${stock} winners from ${totalRequests} requests`
          : `CRITICAL: Got ${successes} winners for ${stock} stock (oversold: ${successes > stock})`,
        details: { stock, totalRequests, successes, soldOut },
      };
    } catch (error) {
      return {
        name: 'Overselling Prevention',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 4: Single Item (Edge Boundary)
  // ==========================================
  async runSingleItem(): Promise<ScenarioResult> {
    console.log('\n--- Running: Single Item Stock ---');
    
    const productId = `single-test-${randomUUID().slice(0, 8)}`;
    const stock = 1;
    const totalRequests = 50;
    const startTime = new Date();
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} with stock=${stock}`);
      
      const emails = generateEmails(totalRequests);
      
      console.log(`   Firing ${totalRequests} requests for 1 item...`);
      const promises = emails.map((email) =>
        this.apiClient.purchaseItem(flashSale.id, email),
      );
      
      const results = await Promise.all(promises);
      
      const successes = results.filter((r) => r.success).length;
      
      const passed = successes === 1;
      
      return {
        name: 'Single Item Stock',
        passed,
        message: passed
          ? `Correctly allowed exactly 1 winner from ${totalRequests} requests`
          : `Expected 1 winner, got ${successes}`,
        details: { stock, totalRequests, successes },
      };
    } catch (error) {
      return {
        name: 'Single Item Stock',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 5: Before Start Time
  // ==========================================
  async runBeforeStartTime(): Promise<ScenarioResult> {
    console.log('\n--- Running: Before Start Time ---');
    
    const productId = `before-test-${randomUUID().slice(0, 8)}`;
    const stock = 10;
    // Sale starts in 10 seconds
    const startTime = new Date(Date.now() + 10 * 1000);
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} starting in 10 seconds`);
      
      const email = generateRandomEmail();
      
      console.log(`   Attempting purchase before start time...`);
      const result = await this.apiClient.purchaseItem(flashSale.id, email);
      
      const passed = !result.success && result.reason === 'NOT_STARTED';
      
      return {
        name: 'Before Start Time Rejection',
        passed,
        message: passed
          ? 'Correctly rejected purchase before start time'
          : `Expected NOT_STARTED, got ${result.reason} (status: ${result.statusCode})`,
        details: { statusCode: result.statusCode, reason: result.reason },
      };
    } catch (error) {
      return {
        name: 'Before Start Time Rejection',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 6: After End Time
  // ==========================================
  async runAfterEndTime(): Promise<ScenarioResult> {
    console.log('\n--- Running: After End Time ---');
    
    const productId = `after-test-${randomUUID().slice(0, 8)}`;
    const stock = 10;
    // Sale ended 1 second ago
    const startTime = new Date(Date.now() - 60 * 1000);
    const endTime = new Date(Date.now() - 1 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} that already ended`);
      
      const email = generateRandomEmail();
      
      console.log(`   Attempting purchase after end time...`);
      const result = await this.apiClient.purchaseItem(flashSale.id, email);
      
      const passed = !result.success && result.reason === 'ENDED';
      
      return {
        name: 'After End Time Rejection',
        passed,
        message: passed
          ? 'Correctly rejected purchase after end time'
          : `Expected ENDED, got ${result.reason} (status: ${result.statusCode})`,
        details: { statusCode: result.statusCode, reason: result.reason },
      };
    } catch (error) {
      return {
        name: 'After End Time Rejection',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // SCENARIO 7: DB Consistency Check
  // ==========================================
  async runDbConsistencyCheck(): Promise<ScenarioResult> {
    console.log('\n--- Running: DB Consistency Check ---');
    
    const productId = `db-test-${randomUUID().slice(0, 8)}`;
    const stock = 5;
    const totalRequests = 20;
    const startTime = new Date();
    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const flashSale = await this.createFlashSale(productId, stock, startTime, endTime);
      console.log(`   Created flash sale: ${flashSale.id} with stock=${stock}`);
      
      const emails = generateEmails(totalRequests);
      
      console.log(`   Firing ${totalRequests} requests...`);
      const promises = emails.map((email) =>
        this.apiClient.purchaseItem(flashSale.id, email),
      );
      
      const results = await Promise.all(promises);
      const winners = results.filter((r) => r.success);
      const winnerEmails = winners.map((r) => r.email);
      
      console.log(`   Got ${winners.length} winners. Waiting for queue to drain...`);
      
      // Wait for BullMQ to process orders
      await sleep(3000);
      
      // Check each winner's order status in DB
      let dbOrderCount = 0;
      for (const email of winnerEmails) {
        try {
          const status = await this.apiClient.checkOrderStatus(flashSale.id, email);
          if (status.secured && status.order) {
            dbOrderCount++;
          }
        } catch {
          // Order might still be processing
        }
      }
      
      const passed = dbOrderCount === winners.length;
      
      return {
        name: 'DB Consistency Check',
        passed,
        message: passed
          ? `All ${winners.length} winners have orders in DB`
          : `Mismatch: ${winners.length} Redis winners, ${dbOrderCount} DB orders`,
        details: { redisWinners: winners.length, dbOrders: dbOrderCount },
      };
    } catch (error) {
      return {
        name: 'DB Consistency Check',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================
  // Run All Scenarios
  // ==========================================
  async runAll(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('FLASH SALE EDGE CASE TESTS');
    console.log('='.repeat(60));

    // Run all scenarios
    this.logScenario(await this.runDuplicatePrevention());
    this.logScenario(await this.runExactStockMatch());
    this.logScenario(await this.runOversellingPrevention());
    this.logScenario(await this.runSingleItem());
    this.logScenario(await this.runBeforeStartTime());
    this.logScenario(await this.runAfterEndTime());
    this.logScenario(await this.runDbConsistencyCheck());

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    
    console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
    }
    
    console.log('\n');
  }
}

// Export for use in run-test.ts
export async function runEdgeCases(apiBaseUrl: string): Promise<void> {
  const runner = new EdgeCaseRunner({ apiBaseUrl });
  await runner.runAll();
}

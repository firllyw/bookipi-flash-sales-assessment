import * as prompts from 'prompts';
import { randomUUID } from 'crypto';
import { ApiClient } from './api-client';
import { CsvWriter } from './csv-writer';
import { TestConfig, PurchaseResult, TestSummary } from './types';
import { runEdgeCases } from './edge-cases';

type TestType = 'load' | 'edge' | 'exit';

function generateRandomEmail(): string {
  return `user_${randomUUID().slice(0, 8)}@loadtest.local`;
}

function generateEmails(count: number): string[] {
  return Array.from({ length: count }, () => generateRandomEmail());
}

function calculateSummary(results: PurchaseResult[]): TestSummary {
  const responseTimes = results.map((r) => r.responseTimeMs);
  
  return {
    totalRequests: results.length,
    winners: results.filter((r) => r.success).length,
    losersSoldOut: results.filter((r) => r.reason === 'SOLD_OUT').length,
    losersAlreadyPurchased: results.filter((r) => r.reason === 'ALREADY_PURCHASED').length,
    losersOther: results.filter(
      (r) => !r.success && r.reason !== 'SOLD_OUT' && r.reason !== 'ALREADY_PURCHASED',
    ).length,
    avgResponseTimeMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
    minResponseTimeMs: Math.min(...responseTimes),
    maxResponseTimeMs: Math.max(...responseTimes),
  };
}

function printSummary(summary: TestSummary): void {
  console.log('\n' + '='.repeat(50));
  console.log('TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Requests:        ${summary.totalRequests}`);
  console.log(`Winners:               ${summary.winners}`);
  console.log(`Losers (Sold Out):     ${summary.losersSoldOut}`);
  console.log(`Losers (Already Purchased): ${summary.losersAlreadyPurchased}`);
  console.log(`Losers (Other):        ${summary.losersOther}`);
  console.log('-'.repeat(50));
  console.log(`Avg Response Time:     ${summary.avgResponseTimeMs}ms`);
  console.log(`Min Response Time:     ${summary.minResponseTimeMs}ms`);
  console.log(`Max Response Time:     ${summary.maxResponseTimeMs}ms`);
  console.log('='.repeat(50));
}

async function selectTestType(): Promise<TestType> {
  const response = await prompts.prompt({
    type: 'select',
    name: 'testType',
    message: 'Select test type',
    choices: [
      { title: 'Load Test - Configurable concurrent requests', value: 'load' },
      { title: 'Edge Case Tests - Automated scenario tests', value: 'edge' },
      { title: 'Exit', value: 'exit' },
    ],
  });

  return response.testType as TestType;
}

async function getApiBaseUrl(): Promise<string> {
  const response = await prompts.prompt({
    type: 'text',
    name: 'apiBaseUrl',
    message: 'API Base URL',
    initial: 'http://localhost:3000',
  });

  return response.apiBaseUrl || 'http://localhost:3000';
}

async function getConfig(): Promise<TestConfig> {
  const response = await prompts.prompt([
    {
      type: 'text',
      name: 'apiBaseUrl',
      message: 'API Base URL',
      initial: 'http://localhost:3000',
    },
    {
      type: 'text',
      name: 'productId',
      message: 'Product ID',
      initial: 'test-product-' + randomUUID().slice(0, 8),
    },
    {
      type: 'number',
      name: 'stock',
      message: 'Stock count (number of items available)',
      initial: 10,
      validate: (value) => (value > 0 ? true : 'Stock must be greater than 0'),
    },
    {
      type: 'number',
      name: 'concurrentRequests',
      message: 'Number of concurrent purchase requests',
      initial: 100,
      validate: (value) => (value > 0 ? true : 'Must be greater than 0'),
    },
    {
      type: 'number',
      name: 'saleDurationMinutes',
      message: 'Flash sale duration (minutes)',
      initial: 5,
      validate: (value) => (value > 0 ? true : 'Must be greater than 0'),
    },
  ]);

  // Check if user cancelled
  if (!response.apiBaseUrl) {
    console.log('Test cancelled.');
    process.exit(0);
  }

  return response as TestConfig;
}

async function runLoadTest(): Promise<void> {
  console.log('\n🚀 Flash Sale Load Test\n');

  // Get configuration from user
  const config = await getConfig();

  const apiClient = new ApiClient(config.apiBaseUrl);
  const csvWriter = new CsvWriter();

  // Calculate time window
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + config.saleDurationMinutes * 60 * 1000);

  console.log('\n📦 Creating flash sale...');
  
  let flashSale;
  try {
    flashSale = await apiClient.createFlashSale(
      config.productId,
      config.stock,
      startTime,
      endTime,
    );
    console.log(`✅ Flash sale created: ${flashSale.id}`);
    console.log(`   Product: ${flashSale.productId}`);
    console.log(`   Stock: ${flashSale.stock}`);
    console.log(`   Window: ${startTime.toISOString()} - ${endTime.toISOString()}`);
  } catch (error) {
    console.error('❌ Failed to create flash sale:', error);
    process.exit(1);
  }

  // Generate random emails
  console.log(`\n📧 Generating ${config.concurrentRequests} random emails...`);
  const emails = generateEmails(config.concurrentRequests);

  // Fire concurrent requests
  console.log(`\n🔥 Firing ${config.concurrentRequests} concurrent purchase requests...`);
  const startTestTime = Date.now();

  const purchasePromises = emails.map((email) =>
    apiClient.purchaseItem(flashSale.id, email),
  );

  const results = await Promise.all(purchasePromises);

  const testDuration = Date.now() - startTestTime;
  console.log(`\n⏱️  All requests completed in ${testDuration}ms`);

  // Calculate and print summary
  const summary = calculateSummary(results);
  printSummary(summary);

  // Write CSV files
  const { winnersPath, losersPath } = csvWriter.writeResults(results);
  
  console.log('\n📄 Output files:');
  console.log(`   Winners: ${winnersPath}`);
  console.log(`   Losers:  ${losersPath}`);

  // Verify winners count matches stock
  if (summary.winners !== config.stock) {
    console.log(
      `\n⚠️  Warning: Winners (${summary.winners}) != Stock (${config.stock})`,
    );
  } else {
    console.log(`\n✅ Perfect! Winners count matches stock count.`);
  }

  console.log('\n');
}

// Main entry point
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(50));
  console.log('FLASH SALE TEST SUITE');
  console.log('='.repeat(50) + '\n');

  const testType = await selectTestType();

  switch (testType) {
    case 'load':
      await runLoadTest();
      break;
    case 'edge':
      const apiBaseUrl = await getApiBaseUrl();
      await runEdgeCases(apiBaseUrl);
      break;
    case 'exit':
      console.log('Goodbye!');
      process.exit(0);
    default:
      console.log('Invalid selection');
      process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});

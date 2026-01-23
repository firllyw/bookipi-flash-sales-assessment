import * as fs from 'fs';
import * as path from 'path';
import { WinnerRecord, LoserRecord, PurchaseResult } from './types';

export class CsvWriter {
  private resultsDir: string;

  constructor(baseDir: string = __dirname) {
    this.resultsDir = path.join(baseDir, 'results');
    this.ensureResultsDir();
  }

  private ensureResultsDir(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  writeResults(results: PurchaseResult[]): { winnersPath: string; losersPath: string } {
    const timestamp = this.getTimestamp();
    const winnersPath = path.join(this.resultsDir, `winners_${timestamp}.csv`);
    const losersPath = path.join(this.resultsDir, `losers_${timestamp}.csv`);

    const winners = results.filter((r) => r.success);
    const losers = results.filter((r) => !r.success);

    this.writeWinnersCsv(winnersPath, winners);
    this.writeLosersCsv(losersPath, losers);

    return { winnersPath, losersPath };
  }

  private writeWinnersCsv(filePath: string, results: PurchaseResult[]): void {
    const header = 'email,flashSaleId,timestamp,responseTimeMs\n';
    const rows = results
      .map((r) => `${r.email},${r.flashSaleId},${r.timestamp.toISOString()},${r.responseTimeMs}`)
      .join('\n');

    fs.writeFileSync(filePath, header + rows);
  }

  private writeLosersCsv(filePath: string, results: PurchaseResult[]): void {
    const header = 'email,flashSaleId,reason,message,timestamp,responseTimeMs\n';
    const rows = results
      .map((r) => {
        const escapedMessage = (r.message || '').replace(/"/g, '""');
        return `${r.email},${r.flashSaleId},${r.reason},"${escapedMessage}",${r.timestamp.toISOString()},${r.responseTimeMs}`;
      })
      .join('\n');

    fs.writeFileSync(filePath, header + rows);
  }
}

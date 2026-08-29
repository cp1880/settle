import { RESOURCES, RESOURCE_IDS } from '../content/resources';
import { BUILDINGS } from '../content/buildings';
import { JOBS } from '../content/jobs';

export class ContentValidator {
  private errors: string[] = [];

  validate(): boolean {
    this.errors = [];
    this.validateBuildings();
    this.validateJobs();

    if (this.errors.length > 0) {
      console.error('[ContentValidator] Validation errors detected:', this.errors);
      return false;
    }

    console.log(`[ContentValidator] Content validated successfully (${RESOURCE_IDS.length} resources, ${Object.keys(BUILDINGS).length} buildings, ${Object.keys(JOBS).length} jobs).`);
    return true;
  }

  private validateBuildings(): void {
    for (const [id, def] of Object.entries(BUILDINGS)) {
      if (def.size.w <= 0 || def.size.h <= 0) {
        this.errors.push(`Building "${id}" has invalid dimensions: ${def.size.w}x${def.size.h}`);
      }

      for (const cost of def.cost) {
        if (!RESOURCES[cost.res]) {
          this.errors.push(`Building "${id}" specifies unregistered cost resource: "${cost.res}"`);
        }
      }

      if (def.trains) {
        if (!RESOURCES[def.trains.outputUnit]) {
          this.errors.push(`Building "${id}" trains unknown unit: "${def.trains.outputUnit}"`);
        }
        for (const req of def.trains.requires) {
          if (!RESOURCES[req.res]) {
            this.errors.push(`Building "${id}" training requires unknown resource: "${req.res}"`);
          }
        }
      }
    }
  }

  private validateJobs(): void {
    for (const [id, job] of Object.entries(JOBS)) {
      for (const input of job.inputs) {
        if (input.from === 'store' && !RESOURCES[input.res]) {
          this.errors.push(`Job "${id}" has unknown store input resource: "${input.res}"`);
        }
      }
      for (const output of job.outputs) {
        if (!RESOURCES[output.res]) {
          this.errors.push(`Job "${id}" has unknown output resource: "${output.res}"`);
        }
      }
      if (job.atBuilding && !BUILDINGS[job.atBuilding]) {
        this.errors.push(`Job "${id}" references unknown building: "${job.atBuilding}"`);
      }
    }
  }

  getErrors(): string[] {
    return this.errors;
  }
}

export function validateContent(): boolean {
  const validator = new ContentValidator();
  return validator.validate();
}

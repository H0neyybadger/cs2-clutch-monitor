import 'dotenv/config';
import path from 'path';
import { createLogger } from '../app/logger';

const logger = createLogger('Module-Test');

interface ModuleResolutionResult {
  projectRoot: string;
  resolvesLocally: boolean;
  resolvedPath: string | null;
  isFromParent: boolean;
  status: 'local' | 'parent' | 'missing';
}

function getProjectRoot(): string {
  return process.cwd();
}

function checkModuleResolution(moduleName: string): ModuleResolutionResult {
  const projectRoot = getProjectRoot();
  
  const result: ModuleResolutionResult = {
    projectRoot,
    resolvesLocally: false,
    resolvedPath: null,
    isFromParent: false,
    status: 'missing',
  };

  try {
    // Try to resolve the module
    const resolvedPath = require.resolve(moduleName);
    result.resolvedPath = resolvedPath;
    result.resolvesLocally = true;

    // Check if the resolved path is within the project
    const normalizedProjectRoot = path.normalize(projectRoot);
    const normalizedResolvedPath = path.normalize(resolvedPath);

    if (normalizedResolvedPath.startsWith(normalizedProjectRoot)) {
      result.status = 'local';
      result.isFromParent = false;
    } else {
      result.status = 'parent';
      result.isFromParent = true;
    }
  } catch (error) {
    // Module not found
    result.status = 'missing';
  }

  return result;
}

async function testModuleResolution(): Promise<void> {
  logger.info('=== Module Resolution Test ===\n');

  const result = checkModuleResolution('discord-rpc');

  logger.info(`Project root path: ${result.projectRoot}`);
  logger.info(`Discord-rpc resolves locally: ${result.resolvesLocally ? 'yes' : 'no'}`);
  
  if (result.resolvedPath) {
    logger.info(`Resolved file path: ${result.resolvedPath}`);
  } else {
    logger.info('Resolved file path: (not found)');
  }

  logger.info(`Appears to be from parent folder: ${result.isFromParent ? 'yes' : 'no'}`);
  logger.info(`Final status: ${result.status}`);

  if (result.status === 'parent') {
    logger.warn('\n⚠️  WARNING: discord-rpc is resolving from outside the project!');
    logger.warn('This may cause issues. Consider installing it locally:');
    logger.warn('  npm install discord-rpc');
  } else if (result.status === 'missing') {
    logger.info('\nℹ️  discord-rpc is not installed.');
    logger.info('To install it locally, run:');
    logger.info('  npm install discord-rpc');
  } else {
    logger.info('\n✓ discord-rpc is installed locally in this project');
  }

  logger.info('\n==============================\n');
}

async function main(): Promise<void> {
  try {
    await testModuleResolution();
    process.exit(0);
  } catch (error) {
    logger.error('Module test failed:', error);
    process.exit(1);
  }
}

main();

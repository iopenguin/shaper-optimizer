import { build } from 'vite';

console.log('Starting Vite build...');
try {
  const result = await build();
  console.log('Build finished successfully:', result ? 'OK' : 'No result');
} catch (err) {
  console.error('Build failed with error:', err);
  process.exit(1);
}

export async function safeFetch(fn, retries = 3, delayMs = 5000) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`⚠️ Network error (attempt ${attempt}): ${err.message}`);

      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }

  throw lastError;
}
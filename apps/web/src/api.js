export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const notify = () => {
    if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()))
      window.dispatchEvent(new CustomEvent('eduforge:mutation', { detail: { path } }));
  };
  if (response.status === 204) {
    notify();
    return null;
  }
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      [body.error?.message, ...(body.error?.details || []).map((d) => `${d.field}: ${d.message}`)]
        .filter(Boolean)
        .join(' '),
    );
  notify();
  return body;
}

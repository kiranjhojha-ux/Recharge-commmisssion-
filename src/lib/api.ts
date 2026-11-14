import { auth } from '../firebase';

export async function apiRequest<T = unknown>(
  url: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('कृपया पहले लॉगिन करें।');
  }
  const token = await user.getIdToken();

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'अनुरोध विफल रहा। कृपया पुनः प्रयास करें।');
  }
  return data;
}

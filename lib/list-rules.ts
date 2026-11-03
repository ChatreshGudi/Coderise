export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function positiveId(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9]\d{0,14}$/.test(String(value)))
    throw new AccountError('Invalid identifier.');
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new AccountError('Invalid identifier.');
  return id;
}
export function listFields(body: Record<string, unknown>) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80)
    throw new AccountError('Use a list name between 1 and 80 characters.');
  const description = body.description ?? '';
  if (typeof description !== 'string' || description.trim().length > 500)
    throw new AccountError('Keep the description within 500 characters.');
  return { name: body.name.trim(), description: description.trim() };
}

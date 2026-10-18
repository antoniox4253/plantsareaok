export function extractResult(
  body: string | null | undefined,
  platform?: string | null
): { type: 'code' | 'link' | 'html'; value: string }

export default function handler(req: any, res: any): Promise<void>

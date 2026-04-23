import { Client } from '@notionhq/client';
import { config } from '../config';

let notionClient: Client | null = null;

export function getNotionClient(): Client | null {
  if (!config.notionApiToken) return null;
  if (!notionClient) {
    notionClient = new Client({ auth: config.notionApiToken });
  }
  return notionClient;
}

export async function createNotionEvent(title: string, date: string, description?: string): Promise<string | null> {
  const notion = getNotionClient();
  if (!notion || !config.notionDatabaseId) return null;

  try {
    // Auto-detect title property name
    let titleProp = 'Name';
    try {
      const dbInfo = await notion.databases.retrieve({ database_id: config.notionDatabaseId });
      const props = (dbInfo as any).properties || {};
      for (const [key, val] of Object.entries(props)) {
        if ((val as any).type === 'title') { titleProp = key; break; }
      }
    } catch { /* use default */ }

    const response = await notion.pages.create({
      parent: { database_id: config.notionDatabaseId },
      properties: {
        [titleProp]: {
          title: [{ text: { content: title } }],
        },
      },
      ...(description ? {
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: description } }],
            },
          },
        ],
      } : {}),
    });
    return response.id;
  } catch (error) {
    console.error('Notion API error:', error);
    return null;
  }
}

export async function getNotionEvents(startDate: string, endDate: string): Promise<any[]> {
  const notion = getNotionClient();
  if (!notion || !config.notionDatabaseId) return [];

  try {
    // Use pages.list or search since databases.query may not be available
    const response = await (notion as any).search({
      filter: {
        value: 'page',
        property: 'object'
      },
    });

    return response.results
      .map((page: any) => ({
        id: page.id,
        title: page.properties?.Name?.title?.[0]?.text?.content || '',
        date: page.properties?.Date?.date?.start || '',
      }))
      .filter((evt: any) => evt.date >= startDate && evt.date <= endDate);
  } catch (error) {
    console.error('Notion query error:', error);
    return [];
  }
}

export function isNotionConfigured(): boolean {
  return !!(config.notionApiToken && config.notionDatabaseId);
}

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
    const response = await notion.pages.create({
      parent: { database_id: config.notionDatabaseId },
      properties: {
        Name: {
          title: [{ text: { content: title } }],
        },
        Date: {
          date: { start: date },
        },
        ...(description ? {
          Description: {
            rich_text: [{ text: { content: description } }],
          },
        } : {}),
      },
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
    const response = await (notion as any).databases.query({
      database_id: config.notionDatabaseId,
      filter: {
        and: [
          { property: 'Date', date: { on_or_after: startDate } },
          { property: 'Date', date: { on_or_before: endDate } },
        ],
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties?.Name?.title?.[0]?.text?.content || '',
      date: page.properties?.Date?.date?.start || '',
    }));
  } catch (error) {
    console.error('Notion query error:', error);
    return [];
  }
}

export function isNotionConfigured(): boolean {
  return !!(config.notionApiToken && config.notionDatabaseId);
}

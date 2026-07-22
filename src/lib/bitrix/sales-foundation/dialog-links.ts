import { DIALOG_LINKS_COLUMNS } from "@/config/sales-foundation";
import { bitrixListAll, bitrixResult } from "@/lib/bitrix/rest-client";
import {
  asString,
  loadUserNames,
  periodToRange,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";

export type DialogLinkRow = Record<(typeof DIALOG_LINKS_COLUMNS)[number], string>;

type BitrixActivity = {
  ID?: string;
  CREATED?: string;
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  RESPONSIBLE_ID?: string;
};

type SessionHistory = {
  sessionId?: number;
  chatId?: number;
  message?: Record<string, { date?: string; senderid?: string }>;
  users?: Record<string, { extranet?: boolean | string }>;
};

export function resolveCrmLinkStatus(input: {
  leadId: string;
  dealId: string;
  contactId: string;
}): string {
  const linked = [Boolean(input.leadId), Boolean(input.dealId), Boolean(input.contactId)].filter(Boolean).length;
  if (linked > 1) return "linked_multiple";
  if (input.dealId) return "linked_deal";
  if (input.leadId) return "linked_lead";
  if (input.contactId) return "linked_contact";
  if (!input.leadId && !input.dealId && !input.contactId) return "unlinked";
  return "unknown";
}

function mapOwner(ownerTypeId: string, ownerId: string) {
  return {
    lead_id: ownerTypeId === "1" ? ownerId : "",
    deal_id: ownerTypeId === "2" ? ownerId : "",
    contact_id: ownerTypeId === "3" ? ownerId : ""
  };
}

export async function fetchDialogLinksRaw(
  periods: string[],
  syncedAt: string,
  options: { maxSessions?: number } = {}
): Promise<{ rows: DialogLinkRow[]; warnings: string[]; errorCode?: string; partial?: boolean }> {
  const warnings: string[] = [];
  const maxSessions = options.maxSessions ?? 500;
  const bySession = new Map<string, DialogLinkRow>();

  try {
    for (const period of periods) {
      const { startIso, endIso } = periodToRange(period);
      const activities = await bitrixListAll<BitrixActivity>("crm.activity.list", {
        filter: {
          ">=CREATED": startIso.slice(0, 19),
          "<=CREATED": endIso.slice(0, 19),
          PROVIDER_ID: "IMOPENLINES_SESSION"
        },
        select: [
          "ID", "CREATED", "OWNER_ID", "OWNER_TYPE_ID", "ASSOCIATED_ENTITY_ID", "SUBJECT", "RESPONSIBLE_ID"
        ],
        order: { CREATED: "ASC" }
      });

      const userNames = await loadUserNames(activities.map((a) => asString(a.RESPONSIBLE_ID)));

      for (const activity of activities) {
        if (bySession.size >= maxSessions) break;
        const sessionId = asString(activity.ASSOCIATED_ENTITY_ID);
        if (!sessionId || bySession.has(sessionId)) continue;

        const ownerTypeId = asString(activity.OWNER_TYPE_ID);
        const ownerId = asString(activity.OWNER_ID);
        const mapped = mapOwner(ownerTypeId, ownerId);
        const crmLinkStatus = resolveCrmLinkStatus({
          leadId: mapped.lead_id,
          dealId: mapped.deal_id,
          contactId: mapped.contact_id
        });
        const identity = resolveSfCustomerKey({
          contactId: mapped.contact_id,
          leadId: mapped.lead_id,
          dealId: mapped.deal_id
        });

        let chatId = "";
        let firstMessageAt = asString(activity.CREATED);
        let lastMessageAt = asString(activity.CREATED);
        let messagesCount = "";
        let clientMessagesCount = "";
        let managerMessagesCount = "";

        try {
          const history = await bitrixResult<SessionHistory>("imopenlines.session.history.get", {
            SESSION_ID: Number(sessionId)
          });
          chatId = history.chatId != null ? String(history.chatId) : "";
          const messages = Object.values(history.message ?? {});
          const dates = messages.map((m) => asString(m.date)).filter(Boolean).sort();
          if (dates.length) {
            firstMessageAt = dates[0];
            lastMessageAt = dates[dates.length - 1];
          }
          let client = 0;
          let manager = 0;
          for (const message of messages) {
            const senderId = asString(message.senderid);
            if (!senderId || senderId === "0") continue;
            const user = history.users?.[senderId];
            const isClient = user?.extranet === true || user?.extranet === "Y";
            if (isClient) client += 1;
            else manager += 1;
          }
          messagesCount = String(client + manager);
          clientMessagesCount = String(client);
          managerMessagesCount = String(manager);
        } catch (error) {
          warnings.push(
            `session ${sessionId} history skipped: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        bySession.set(sessionId, {
          dialog_id: `ol:${sessionId}`,
          session_id: sessionId,
          chat_id: chatId,
          owner_type_id: ownerTypeId,
          owner_id: ownerId,
          lead_id: mapped.lead_id,
          deal_id: mapped.deal_id,
          contact_id: mapped.contact_id,
          manager_id: asString(activity.RESPONSIBLE_ID),
          manager_name: userNames.get(asString(activity.RESPONSIBLE_ID)) || "",
          first_message_at: firstMessageAt,
          last_message_at: lastMessageAt,
          messages_count: messagesCount,
          client_messages_count: clientMessagesCount,
          manager_messages_count: managerMessagesCount,
          customer_key: identity.customer_key,
          crm_link_status: crmLinkStatus,
          sync_updated_at: syncedAt
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`dialog links sync failed: ${message}`);
    return {
      rows: [...bySession.values()],
      warnings,
      errorCode: "BITRIX_DIALOGS_DENIED",
      partial: true
    };
  }

  if (!bySession.size) warnings.push("No Open Lines dialog links found");
  return {
    rows: [...bySession.values()].sort((a, b) => a.session_id.localeCompare(b.session_id, "en", { numeric: true })),
    warnings
  };
}

export function dialogLinksToSheetRows(rows: DialogLinkRow[]): Array<Array<string | number>> {
  return rows.map((row) => DIALOG_LINKS_COLUMNS.map((column) => row[column] ?? ""));
}

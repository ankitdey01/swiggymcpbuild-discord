import { Events, ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { CustomClient, Event } from "../../structure/index.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import { getSwiggyAccessToken } from "../../utils/swiggyMcp.js";
import { swiggyTools, SwiggyToolArguments } from "../../utils/swiggyTools.js";

const ADDRESS_CATEGORIES = ["HOME", "WORK", "OTHER"] as const;
type AddressCategory = (typeof ADDRESS_CATEGORIES)[number];

type InstamartAddressInput = {
  fullAddress: string;
  addressLine: string;
  addressLine2: string;
  locality: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  addressCategory: AddressCategory;
  userName: string;
  userPhone: string;
  receiverPhone: string;
};

const INSTAMART_ADDRESS_ADD_MODAL_ID = "instamart-address-add-modal";
const INSTAMART_ADDRESS_REMOVE_MODAL_ID = "instamart-address-remove-modal";
const REMOVE_MODAL_INPUT_ID = "instamart-address-remove-id";
const ADD_MODAL_INPUTS = {
  addressLines: "instamart-address-lines",
  localityCityPin: "instamart-address-locality-city-pin",
  coordinates: "instamart-address-coordinates",
  category: "instamart-address-category",
  contacts: "instamart-address-contacts",
} as const;

function getDiscordApiErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;

  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

function userFacingError(error: unknown): string {
  const classified = classifySwiggyError(error);
  if (classified.category === "UNKNOWN" && error instanceof Error && error.message) return error.message;
  return classified.userFriendlyMessage;
}

const dataOf = (payload: any) => payload?.data || payload?.result || payload;
const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function text(value: any, keys: string[]): string | null {
  if (!isRecord(value)) return null;

  for (const key of keys) {
    const child = value[key];
    if ((typeof child === "string" && child.trim()) || typeof child === "number") return String(child).trim();
  }

  return null;
}

function firstArray(value: any, predicate: (item: any) => boolean): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value) && value.some(predicate)) return value;

  for (const child of Object.values(value)) {
    const found = firstArray(child, predicate);
    if (found.length) return found;
  }

  return [];
}

function assertToolSuccess(payload: any, toolName: string) {
  if (payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `${toolName} failed.`;
    throw new Error(message);
  }
}

function addressLooksLikeRecord(item: any): boolean {
  return (
    isRecord(item) &&
    Boolean(
      text(item, [
        "fullAddress",
        "address",
        "displayAddress",
        "formattedAddress",
        "addressLine",
        "addressCategory",
        "category",
        "addressTag",
        "userName",
        "receiverPhone",
        "selectedAddress",
        "addressId",
        "id",
      ])
    )
  );
}

function getAddressId(address: any, data: any, addressCount: number): string | null {
  return (
    text(address, ["selectedAddress", "addressId", "id", "address_id"]) ||
    (addressCount === 1 ? text(data, ["selectedAddress", "addressId", "id"]) : null)
  );
}

function extractAddresses(payload: any): any[] {
  const data = dataOf(payload);
  const direct =
    (Array.isArray(data?.addresses) && data.addresses) ||
    (Array.isArray(data?.addressList) && data.addressList) ||
    (Array.isArray(data?.savedAddresses) && data.savedAddresses) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data);

  return Array.isArray(direct) ? direct.filter(addressLooksLikeRecord) : firstArray(data, addressLooksLikeRecord);
}

function extractInstamartAddressIds(payload: any): string[] {
  const data = dataOf(payload);
  const addresses = extractAddresses(payload);
  const ids = new Set<string>();

  for (const address of addresses) {
    const id = getAddressId(address, data, addresses.length);
    if (id) ids.add(id);
  }

  const selectedAddress = text(data, ["selectedAddress"]);
  if (selectedAddress) ids.add(selectedAddress);

  return [...ids];
}

async function getInstamartAddresses(accessToken: string) {
  const result = await swiggyTools.instamart.getAddresses(accessToken);
  assertToolSuccess(result, "get_addresses");
  return result;
}

async function createInstamartAddress(accessToken: string, input: InstamartAddressInput) {
  const args: SwiggyToolArguments = {
    fullAddress: input.fullAddress,
    addressLine: input.addressLine,
    addressLine2: input.addressLine2,
    locality: input.locality,
    city: input.city,
    postalCode: input.postalCode,
    latitude: input.latitude,
    longitude: input.longitude,
    addressCategory: input.addressCategory,
    userName: input.userName,
    userPhone: input.userPhone,
    receiverPhone: input.receiverPhone,
  };

  const result = await swiggyTools.instamart.createAddress(accessToken, args);
  assertToolSuccess(result, "create_address");
  return { args, result };
}

async function deleteInstamartAddress(accessToken: string, addressId: string) {
  const result = await swiggyTools.instamart.deleteAddress(accessToken, { addressId });
  assertToolSuccess(result, "delete_address");
  return result;
}



function splitRequired(value: string, expected: number, label: string): string[] {
  const parts = value.split("|").map((part) => part.trim());
  if (parts.length < expected || parts.slice(0, expected).some((part) => !part)) {
    throw new Error(`${label} must use the format shown in the placeholder.`);
  }
  return parts;
}

function requirePin(value: string): string {
  const postalCode = value.trim();
  if (!/^\d{6}$/.test(postalCode)) throw new Error("PIN must be a 6-digit postal code.");
  return postalCode;
}

function buildFullAddress(input: Omit<InstamartAddressInput, "fullAddress">): string {
  return [input.addressLine, input.addressLine2, input.locality, input.city, input.postalCode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}



function parseAddressAddModal(fields: ModalSubmitInteraction["fields"]) {
  const [addressLine, addressLine2] = splitRequired(
    fields.getTextInputValue(ADD_MODAL_INPUTS.addressLines),
    2,
    "Main Street and Apartment"
  );
  const [locality, city, postalCodeRaw] = splitRequired(
    fields.getTextInputValue(ADD_MODAL_INPUTS.localityCityPin),
    3,
    "Locality, City, and PIN"
  );
  const [latitudeRaw, longitudeRaw] = splitRequired(
    fields.getTextInputValue(ADD_MODAL_INPUTS.coordinates),
    2,
    "Coordinates"
  );
  const [userName, receiverPhone, userPhone] = splitRequired(
    fields.getTextInputValue(ADD_MODAL_INPUTS.contacts),
    3,
    "Name, receiver phone, and your phone"
  );
  const categoryRaw = fields.getTextInputValue(ADD_MODAL_INPUTS.category).trim();

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const postalCode = requirePin(postalCodeRaw);
  const addressCategory = categoryRaw.toUpperCase() as AddressCategory;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Latitude and longitude must be valid numbers.");
  if (!ADDRESS_CATEGORIES.includes(addressCategory)) {
    throw new Error(`Address category must be one of: ${ADDRESS_CATEGORIES.join(", ")}.`);
  }

  const inputWithoutFullAddress = {
    addressLine,
    addressLine2,
    locality,
    city,
    postalCode,
    latitude,
    longitude,
    addressCategory,
    userName,
    userPhone,
    receiverPhone,
  };

  return {
    fullAddress: buildFullAddress(inputWithoutFullAddress),
    ...inputWithoutFullAddress,
  };
}

function parseInstamartAddressRemoveModal(fields: ModalSubmitInteraction["fields"]) {
  return fields.getTextInputValue(REMOVE_MODAL_INPUT_ID).trim();
}

async function handleAddressAddModal(interaction: ModalSubmitInteraction, client: CustomClient) {
  const accessToken = getSwiggyAccessToken(client, interaction.user.id);
  if (!accessToken) {
    return interaction.reply({
      content: "Use `/login` to connect your Swiggy account before managing Instamart addresses.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const input = parseAddressAddModal(interaction.fields);
    const { args, result } = await createInstamartAddress(accessToken, input);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff5200)
          .setAuthor({ name: "Swiggy Instamart" })
          .setTitle("Address Added")
          .setDescription(`Created \`${input.addressCategory}\` address for ${input.city}.`)
          .addFields(
            {
              name: "Tool Call Arguments",
              value: `\`\`\`json\n${JSON.stringify(args, null, 2)?.replace(/`/g, "'").slice(0, 1000)}\n\`\`\``,
              inline: false,
            },
            {
              name: "Tool Output",
              value: `\`\`\`json\n${JSON.stringify(result, null, 2)?.replace(/`/g, "'").slice(0, 1000)}\n\`\`\``,
              inline: false,
            }
          )
          .setTimestamp(),
      ],
    });
  } catch (error) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xd83c3e)
          .setAuthor({ name: "Swiggy Instamart" })
          .setTitle("Could Not Add Address")
          .setDescription(userFacingError(error))
          .setTimestamp(),
      ],
    });
  }
}

async function handleAddressRemoveModal(interaction: ModalSubmitInteraction, client: CustomClient) {
  const accessToken = getSwiggyAccessToken(client, interaction.user.id);
  if (!accessToken) {
    return interaction.reply({
      content: "Use `/login` to connect your Swiggy account before managing Instamart addresses.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const addressId = parseInstamartAddressRemoveModal(interaction.fields);
    if (!addressId) throw new Error("Address ID is required.");

    const addresses = await getInstamartAddresses(accessToken);
    const knownAddressIds = extractInstamartAddressIds(addresses);

    if (knownAddressIds.length && !knownAddressIds.includes(addressId)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xd83c3e)
            .setAuthor({ name: "Swiggy Instamart" })
            .setTitle("Address Not Found")
            .setDescription("No saved address matched that ID. Run `/instamart address` and paste the ID shown on the address you want to remove.")
            .setTimestamp(),
        ],
      });
    }

    await deleteInstamartAddress(accessToken, addressId);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff5200)
          .setAuthor({ name: "Swiggy Instamart" })
          .setTitle("Address Removed")
          .setDescription(`Deleted address ID \`${addressId.replace(/`/g, "'")}\\.`)
          .setTimestamp(),
      ],
    });
  } catch (error) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xd83c3e)
          .setAuthor({ name: "Swiggy Instamart" })
          .setTitle("Could Not Remove Address")
          .setDescription(userFacingError(error))
          .setTimestamp(),
      ],
    });
  }
}

export default new Event({
  name: Events.InteractionCreate,

  async execute(interaction: ModalSubmitInteraction, client: CustomClient): Promise<any> {
    try {
      if (!interaction.isModalSubmit()) return;

      if (interaction.customId === INSTAMART_ADDRESS_ADD_MODAL_ID) {
        return handleAddressAddModal(interaction, client);
      }

      if (interaction.customId === INSTAMART_ADDRESS_REMOVE_MODAL_ID) {
        return handleAddressRemoveModal(interaction, client);
      }
    } catch (error) {
      const code = getDiscordApiErrorCode(error);
      if (code === 10062 || code === 40060) return;
      throw error;
    }
  },
});

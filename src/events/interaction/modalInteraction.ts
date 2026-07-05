import { Events, ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { CustomClient, Event, isIgnorableInteractionError } from "../../structure/index.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import { getSwiggyAccessToken } from "../../utils/swiggyMcp.js";
import { swiggyTools, SwiggyToolArguments } from "../../utils/swiggyTools.js";
import { assertToolSuccess, extractInstamartAddressIds } from "../../utils/swiggyPayload.js";
import {
  ADD_MODAL_INPUTS,
  INSTAMART_ADDRESS_ADD_MODAL_ID,
  INSTAMART_ADDRESS_REMOVE_MODAL_ID,
  REMOVE_MODAL_INPUT_ID,
} from "../../utils/instamartConstants.js";

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

function userFacingError(error: unknown): string {
  const classified = classifySwiggyError(error);
  if (classified.category === "UNKNOWN" && error instanceof Error && error.message) return error.message;
  return classified.userFriendlyMessage;
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
              value: `\`\`\`json\n${JSON.stringify(args, null, 2).replace(/`/g, "'").slice(0, 1000)}\n\`\`\``,
              inline: false,
            },
            {
              name: "Tool Output",
              value: `\`\`\`json\n${JSON.stringify(result, null, 2).replace(/`/g, "'").slice(0, 1000)}\n\`\`\``,
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
          .setDescription(`Deleted address ID \`${addressId.replace(/`/g, "'")}\`.`)
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
      if (isIgnorableInteractionError(error)) return;
      throw error;
    }
  },
});

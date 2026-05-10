import {
  ActionRowBuilder,
  ButtonInteraction,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Event } from "../../structure/index.js";

const ADD_BUTTON_ID = "instamart-address-add";
const REMOVE_BUTTON_ID = "instamart-address-remove";
const INSTAMART_ADDRESS_BUTTON_IDS = [ADD_BUTTON_ID, REMOVE_BUTTON_ID] as const;
const INSTAMART_ADDRESS_ADD_MODAL_ID = "instamart-address-add-modal";
const INSTAMART_ADDRESS_REMOVE_MODAL_ID = "instamart-address-remove-modal";
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

function buildInstamartAddressAddModal() {
  const modal = new ModalBuilder()
    .setCustomId(INSTAMART_ADDRESS_ADD_MODAL_ID)
    .setTitle("Add Instamart Address");

  const addressLines = new TextInputBuilder()
    .setCustomId(ADD_MODAL_INPUTS.addressLines)
    .setLabel("Main Street | Apartment")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("1, Main Street | Apartment 4B")
    .setRequired(true)
    .setMaxLength(300);

  const localityCityPin = new TextInputBuilder()
    .setCustomId(ADD_MODAL_INPUTS.localityCityPin)
    .setLabel("Locality | City | PIN")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Indiranagar | Bengaluru | 560038")
    .setRequired(true)
    .setMaxLength(180);

  const coordinates = new TextInputBuilder()
    .setCustomId(ADD_MODAL_INPUTS.coordinates)
    .setLabel("Latitude | Longitude")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("12.9716 | 77.5946")
    .setRequired(true)
    .setMaxLength(80);

  const category = new TextInputBuilder()
    .setCustomId(ADD_MODAL_INPUTS.category)
    .setLabel("Category")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter HOME or WORK or OTHER")
    .setRequired(true)
    .setMaxLength(20);

  const contacts = new TextInputBuilder()
    .setCustomId(ADD_MODAL_INPUTS.contacts)
    .setLabel("Name | Receiver Phone | Your Phone")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ankit | 9876543210 | 9876543210")
    .setRequired(true)
    .setMaxLength(180);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(addressLines),
    new ActionRowBuilder<TextInputBuilder>().addComponents(localityCityPin),
    new ActionRowBuilder<TextInputBuilder>().addComponents(coordinates),
    new ActionRowBuilder<TextInputBuilder>().addComponents(category),
    new ActionRowBuilder<TextInputBuilder>().addComponents(contacts)
  );

  return modal;
}

function buildInstamartAddressRemoveModal() {
  const modal = new ModalBuilder()
    .setCustomId(INSTAMART_ADDRESS_REMOVE_MODAL_ID)
    .setTitle("Remove Instamart Address");

  const addressId = new TextInputBuilder()
    .setCustomId("instamart-address-remove-id")
    .setLabel("Address ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Paste the address ID from the address embed")
    .setRequired(true)
    .setMaxLength(160);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(addressId));
  return modal;
}

async function handleAddressButton(interaction: ButtonInteraction) {
  if (!INSTAMART_ADDRESS_BUTTON_IDS.includes(interaction.customId as (typeof INSTAMART_ADDRESS_BUTTON_IDS)[number])) {
    return;
  }

  if (interaction.customId === ADD_BUTTON_ID) {
    return interaction.showModal(buildInstamartAddressAddModal());
  }

  if (interaction.customId === REMOVE_BUTTON_ID) {
    return interaction.showModal(buildInstamartAddressRemoveModal());
  }
}

export default new Event({
  name: Events.InteractionCreate,

  async execute(interaction: ButtonInteraction): Promise<any> {
    try {
      if (!interaction.isButton()) return;
      return handleAddressButton(interaction);
    } catch (error) {
      const code = getDiscordApiErrorCode(error);
      if (code === 10062 || code === 40060) return;
      throw error;
    }
  },
});

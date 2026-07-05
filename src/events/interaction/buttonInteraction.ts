import {
  ActionRowBuilder,
  ButtonInteraction,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Event, isIgnorableInteractionError } from "../../structure/index.js";
import {
  ADD_BUTTON_ID,
  ADD_MODAL_INPUTS,
  INSTAMART_ADDRESS_ADD_MODAL_ID,
  INSTAMART_ADDRESS_REMOVE_MODAL_ID,
  REMOVE_BUTTON_ID,
  REMOVE_MODAL_INPUT_ID,
} from "../../utils/instamartConstants.js";

const INSTAMART_ADDRESS_BUTTON_IDS = [ADD_BUTTON_ID, REMOVE_BUTTON_ID] as const;

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
    .setCustomId(REMOVE_MODAL_INPUT_ID)
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
      if (isIgnorableInteractionError(error)) return;
      throw error;
    }
  },
});

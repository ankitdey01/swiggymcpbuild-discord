/**
 * Custom IDs shared by the Instamart address flow. These strings are the
 * contract between the command (which renders the buttons), the button handler
 * (which opens the modals) and the modal handler (which reads the fields), so
 * they live in one place instead of being duplicated across all three.
 */

export const ADD_BUTTON_ID = "instamart-address-add";
export const REMOVE_BUTTON_ID = "instamart-address-remove";

export const INSTAMART_ADDRESS_ADD_MODAL_ID = "instamart-address-add-modal";
export const INSTAMART_ADDRESS_REMOVE_MODAL_ID = "instamart-address-remove-modal";
export const REMOVE_MODAL_INPUT_ID = "instamart-address-remove-id";

export const ADD_MODAL_INPUTS = {
  addressLines: "instamart-address-lines",
  localityCityPin: "instamart-address-locality-city-pin",
  coordinates: "instamart-address-coordinates",
  category: "instamart-address-category",
  contacts: "instamart-address-contacts",
} as const;

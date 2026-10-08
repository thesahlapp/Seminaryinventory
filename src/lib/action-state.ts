export type ActionState = {
  error?: string;
  success?: string;
  /** Set by createItem so the form can upload photos to the new item. */
  itemId?: string;
};

export const initialActionState: ActionState = {};

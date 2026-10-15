/** Only draft weeks can be edited, regenerated, or have hours imported. */
export const isPeriodEditable = (status?: string | null) => status === 'draft';

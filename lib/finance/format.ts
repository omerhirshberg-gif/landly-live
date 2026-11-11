// Money in the admin portal: whole agorot in, "₪1,234.50" out. Wrap in <bdi dir="ltr">.
export const formatShekel = (agorot: number) =>
  `₪${(agorot / 100).toLocaleString('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

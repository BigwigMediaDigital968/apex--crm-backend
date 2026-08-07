export const buildSort = (field = "createdAt", order = "desc") => ({
  [field]: order === "asc" ? 1 : -1,
});

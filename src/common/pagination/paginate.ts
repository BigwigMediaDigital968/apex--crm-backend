export const getPagination = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  limit,
});

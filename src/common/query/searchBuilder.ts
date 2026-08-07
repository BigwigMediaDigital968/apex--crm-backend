export const buildSearchFilter = (keyword: string, fields: string[]) => {
  if (!keyword) {
    return {};
  }

  return {
    $or: fields.map((field) => ({
      [field]: {
        $regex: keyword,

        $options: "i",
      },
    })),
  };
};

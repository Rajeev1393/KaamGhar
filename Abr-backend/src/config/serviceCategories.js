const serviceCategories = [
  { name: "Plumber", label: "Plumbing" },
  { name: "Electrician", label: "Electrical" },
  { name: "Cleaning", label: "Home cleaning" },
  { name: "AC Repair", label: "AC repair" },
  { name: "Carpenter", label: "Carpentry" },
  { name: "Salon", label: "At-home salon" }
];

let currentServiceCategories = serviceCategories;

function getServiceCategories() {
  return currentServiceCategories;
}

function setServiceCategories(categories) {
  currentServiceCategories = categories
    .map(({ name, label }) => ({ name, label }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findServiceCategory(value) {
  if (typeof value !== "string") return undefined;
  return currentServiceCategories.find(({ name }) => name.toLowerCase() === value.trim().toLowerCase());
}

function isServiceCategory(value) {
  return Boolean(findServiceCategory(value));
}

module.exports = {
  findServiceCategory,
  getServiceCategories,
  isServiceCategory,
  serviceCategories,
  setServiceCategories
};

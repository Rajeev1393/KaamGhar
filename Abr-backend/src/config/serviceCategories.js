const serviceCategories = [
  { name: "Plumber", label: "Plumbing", price: 500 },
  { name: "Electrician", label: "Electrical", price: 500 },
  { name: "Cleaning", label: "Home cleaning", price: 500 },
  { name: "AC Repair", label: "AC repair", price: 500 },
  { name: "Carpenter", label: "Carpentry", price: 500 },
  { name: "Salon", label: "At-home salon", price: 500 }
];

let currentServiceCategories = serviceCategories;

function getServiceCategories() {
  return currentServiceCategories;
}

function setServiceCategories(categories) {
  currentServiceCategories = categories
    .map(({ name, label, price, commission }) => ({
      name,
      label,
      price: price ?? 500,
      ...(commission?.type && { commission: { type: commission.type, value: commission.value } })
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findServiceCategory(value) {
  if (typeof value !== "string") return undefined;
  return currentServiceCategories.find(({ name }) => name.toLowerCase() === value.trim().toLowerCase());
}

function isServiceCategory(value) {
  return Boolean(findServiceCategory(value));
}

function getCategoryPricing({ price, commission }) {
  const commissionPaise = Math.round(commission?.type === "percentage"
    ? price * commission.value
    : (commission?.value ?? 0) * 100);
  return {
    price: (Math.round(price * 100) + commissionPaise) / 100,
    hourlyCommission: commissionPaise / 100
  };
}

module.exports = {
  getCategoryPricing,
  findServiceCategory,
  getServiceCategories,
  isServiceCategory,
  serviceCategories,
  setServiceCategories
};

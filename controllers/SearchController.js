// controllers/SearchController.js
const { db } = require('../config/db'); // Ensure db is your Firebase RTDB instance

// -------------------------
// Province to city mapping (unchanged from your code)
const provinceCityMapping = {
  Punjab: [
    "Ahmadpur East",
    "Alipur",
    "Attock",
    "Bahawalnagar",
    "Bahawalpur",
    "Bhalwal",
    "Chakwal",
    "Chiniot",
    "Dera Ghazi Khan",
    "Faisalabad",
    "Gujranwala",
    "Jhelum",
    "Kasur",
    "Lahore",
    "Gojra",
    "Hafizabad",
    "Islamabad",
    "Mirpur",
    "Multan",
    "Okara",
    "Rawalpindi",
    "Sahiwal",
    "Sialkot",
    "Wah Cantt"
  ],
  Sindh: [
    "Karachi",
    "Jacobabad",
    "Nawabshah",
    "Khairpur",
    "Larkana",
    "Sukkur"
  ],
  KPK: [
    "Abbottabad",
    "Bannu",
    "Dera Ismail Khan",
    "Haripur",
    "Peshawar",
    "Swat",
    "Zhob",
    "Barikot",
    "Gilgit",
    "Kotli",
    "Mardan",
    "Muzaffarabad"
  ],
  Balochistan: [
    "Khuzdar",
    "Quetta",
    "Turbat",
    "Chaman"
  ]
};

// -------------------------
// Helper: parse ISO date string to Date object
function parseISODate(dateString) {
  return new Date(dateString);
}

// -------------------------
// Helper: Check if two date ranges overlap
function isDateOverlap(selectedStart, selectedEnd, activityStart, activityEnd) {
  return selectedEnd >= activityStart && selectedStart <= activityEnd;
}

// -------------------------
// Controller: searchActivities
// Expects in req.body:
//  - searchQuery: string (to match activity.city)
//  - selectedRegion: string ("1" means flexible; "2" => Punjab, "3" => Sindh, "4" => KPK, "5" => Balochistan)
//  - rawDateRange: { startDate, endDate } in ISO string format (optional)
//  - guestDetails: object with properties:
//       - category (e.g. "Adults")
//       - value (number of guests selected)
// Both guestDetails conditions must meet: activity.ageGroup must match
// and activity.maxGuestsPerTime must be >= guestDetails.value.
const searchActivities = async (req, res) => {
  try {
    const {
      searchQuery = "",
      selectedRegion = "1",
      rawDateRange,  // { startDate, endDate } if provided
      guestDetails,  // { category: "Adults", value: number } if provided
    } = req.body;

    console.log("[searchActivities] Received parameters:", {
      searchQuery,
      selectedRegion,
      rawDateRange,
      guestDetails
    });

    // 1) Retrieve all activities from Firebase RTDB
    const snapshot = await db.ref("activities").once("value");
    const activitiesData = snapshot.val();
    if (!activitiesData) {
      console.log("[searchActivities] No activities found in database.");
      return res.status(200).send({ activities: [] });
    }

    const activities = Object.values(activitiesData);

    // 2) Apply filters
    const filteredActivities = activities.filter((activity) => {
      let matches = true;

      // (a) City text search
      if (searchQuery) {
        if (!activity.city.trim().toLowerCase()
          .includes(searchQuery.trim().toLowerCase())) {
          matches = false;
        }
      }

      // (b) Province filter
      if (selectedRegion !== "1") {
        let provinceName = "";
        switch (selectedRegion) {
          case "2": provinceName = "Punjab"; break;
          case "3": provinceName = "Sindh"; break;
          case "4": provinceName = "KPK"; break;
          case "5": provinceName = "Balochistan"; break;
          default: provinceName = "";
        }
        if (provinceName) {
          const citiesInProvince = provinceCityMapping[provinceName] || [];
          if (!citiesInProvince.some(
            city => city.trim().toLowerCase() === activity.city.trim().toLowerCase()
          )) {
            matches = false;
          }
        }
      }

      // (c) Date range filter: single date or range
      if (rawDateRange && rawDateRange.startDate && activity.dateRange) {
        // If endDate is null, treat it as the same as startDate (single-day filter)
        const selectedStart = new Date(rawDateRange.startDate);
        const selectedEnd = rawDateRange.endDate
          ? new Date(rawDateRange.endDate)
          : selectedStart; // single date scenario

        const activityStart = parseISODate(activity.dateRange.startDate);
        const activityEnd = parseISODate(activity.dateRange.endDate);

        if (!isDateOverlap(selectedStart, selectedEnd, activityStart, activityEnd)) {
          matches = false;
        }
      }

      // (d) Guest details filter
      if (guestDetails && guestDetails.category) {
        // Age group match
        if (
          activity.ageGroup &&
          activity.ageGroup.trim().toLowerCase() !== guestDetails.category.trim().toLowerCase()
        ) {
          matches = false;
        }
        // maxGuestsPerTime check
        if (
          activity.maxGuestsPerTime === undefined ||
          Number(activity.maxGuestsPerTime) < Number(guestDetails.value)
        ) {
          matches = false;
        }
      }

      return matches;
    });

    console.log(`[searchActivities] Returning ${filteredActivities.length} matching activities.`);
    return res.status(200).send({ activities: filteredActivities });

  } catch (error) {
    console.error("[searchActivities] Error during search:", error);
    return res.status(500).send({ error: "Failed to search activities." });
  }
};

module.exports = { searchActivities };

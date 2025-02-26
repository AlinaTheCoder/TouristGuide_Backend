// controllers/SearchController.js
const { db } = require('../config/db'); // Ensure db is your Firebase RTDB instance

// -------------------------
// Province -> City mapping (unchanged)
const provinceCityMapping = {
  Punjab: [
    "Ahmadpur East", "Alipur", "Attock", "Bahawalnagar", "Bahawalpur",
    "Bhalwal", "Chakwal", "Chiniot", "Dera Ghazi Khan", "Faisalabad",
    "Gujranwala", "Jhelum", "Kasur", "Lahore", "Gojra", "Hafizabad",
    "Islamabad", "Mirpur", "Multan", "Okara", "Rawalpindi", "Sahiwal",
    "Sialkot", "Wah Cantt"
  ],
  Sindh: [
    "Karachi", "Jacobabad", "Nawabshah", "Khairpur", "Larkana", "Sukkur"
  ],
  KPK: [
    "Abbottabad", "Bannu", "Dera Ismail Khan", "Haripur", "Peshawar",
    "Swat", "Zhob", "Barikot", "Gilgit", "Kotli", "Mardan", "Muzaffarabad"
  ],
  Balochistan: [
    "Khuzdar", "Quetta", "Turbat", "Chaman"
  ]
};

// -------------------------
// Helper: parse ISO date string
function parseISODate(dateString) {
  return new Date(dateString);
}

// -------------------------
// Helper: Check date-range overlap
function isDateOverlap(selectedStart, selectedEnd, activityStart, activityEnd) {
  return selectedEnd >= activityStart && selectedStart <= activityEnd;
}

// -------------------------
// Age group check: user picks a category, activity has an ageGroup
function doesAgeGroupMatch(userCategory, activityCat) {
  if (!activityCat) return false; // If activity has no ageGroup, can't match

  // "All Ages (1+)" => everything
  if (userCategory === "All Ages (1+)") {
    return true;
  }
  // Otherwise, exact match required for single or combined categories:
  // e.g. "Children", "Teenagers", "Adults",
  //      "Children and Teenagers", "Teenagers and Adults"
  return userCategory.trim().toLowerCase() === activityCat.trim().toLowerCase();
}

// -------------------------
// Controller: searchActivities
// Expects in req.body:
//  - searchQuery: string
//  - selectedRegion: string ("1" => flexible)
//  - rawDateRange: { startDate, endDate } in ISO strings
//  - guestDetails: { category, value }
const searchActivities = async (req, res) => {
  try {
    const {
      searchQuery = "",
      selectedRegion = "1",
      rawDateRange,
      guestDetails,
    } = req.body;

    console.log("[searchActivities] Received parameters:", {
      searchQuery,
      selectedRegion,
      rawDateRange,
      guestDetails
    });

    // 1) Retrieve all activities
    const snapshot = await db.ref("activities").once("value");
    const activitiesData = snapshot.val();
    if (!activitiesData) {
      console.log("[searchActivities] No activities found in database.");
      return res.status(200).send({ activities: [] });
    }

    const activities = Object.values(activitiesData);

    // 2) Filter
    const filteredActivities = activities.filter((activity) => {
      let matches = true;

      // (a) City search
      if (searchQuery) {
        if (!activity.city ||
            !activity.city.trim().toLowerCase()
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
          const activityCity = (activity.city || "").trim().toLowerCase();
          if (!citiesInProvince.some(city =>
            city.trim().toLowerCase() === activityCity
          )) {
            matches = false;
          }
        }
      }

      // (c) Date range: single or 2-date
      if (rawDateRange && rawDateRange.startDate && activity.dateRange) {
        const selectedStart = new Date(rawDateRange.startDate);
        const selectedEnd = rawDateRange.endDate
          ? new Date(rawDateRange.endDate)
          : selectedStart; // single day

        const activityStart = parseISODate(activity.dateRange.startDate);
        const activityEnd   = parseISODate(activity.dateRange.endDate);

        if (!isDateOverlap(selectedStart, selectedEnd, activityStart, activityEnd)) {
          matches = false;
        }
      }

      // (d) Guest details
      if (guestDetails && guestDetails.category) {
        // Age group exact match (unless "All Ages (1+)")
        if (!doesAgeGroupMatch(guestDetails.category, activity.ageGroup || "")) {
          matches = false;
        }
        // maxGuestsPerTime
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

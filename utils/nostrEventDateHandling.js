// utils/nostrUtils.js - Make sure publishEventToNostr uses proper date formats
// 
// Example implementation for publishEventToNostr:
//
// export const publishEventToNostr = async (eventDetails) => {
//   const eventKind = eventDetails.startTimestamp ? 31923 : 31922; // Time-based vs date-based
//   
//   const tags = [
//     ["d", generateEventId()], // Unique identifier
//     ["title", eventDetails.title],
//     ["summary", eventDetails.description || ""],
//   ];
//
//   // Use ISO dates for date-based events, timestamps for time-based events
//   if (eventKind === 31922) {
//     // Date-based event
//     tags.push(["start", eventDetails.isoStartDate]); // YYYY-MM-DD
//     if (eventDetails.isoEndDate) {
//       tags.push(["end", eventDetails.isoEndDate]); // YYYY-MM-DD
//     }
//   } else {
//     // Time-based event  
//     tags.push(["start", eventDetails.startTimestamp.toString()]); // Unix timestamp
//     if (eventDetails.endTimestamp) {
//       tags.push(["end", eventDetails.endTimestamp.toString()]); // Unix timestamp
//     }
//   }
//
//   if (eventDetails.location) {
//     tags.push(["location", eventDetails.location]);
//   }
//
//   if (eventDetails.image) {
//     tags.push(["image", eventDetails.image]);
//   }
//
//   if (eventDetails.url) {
//     tags.push(["r", eventDetails.url]);
//   }
//
//   const event = {
//     kind: eventKind,
//     created_at: Math.floor(Date.now() / 1000),
//     content: eventDetails.description || "",
//     tags: tags
//   };
//
//   // Sign and publish the event...
// };
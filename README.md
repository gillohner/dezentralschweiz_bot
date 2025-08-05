# Dezentralschweiz Bot

The **Dezentralschweiz Bot** is a Telegram bot designed to provide users with information about upcoming meetups in the [Dezentralschweiz](https://dezentralschweiz.ch/) community. It fetches events from various relays using the Nostr protocol and displays them in a user-friendly format.

## Features

- **Fetch Upcoming Meetups**: Use the `/meetups` command to retrieve a list of upcoming events.
  - **Event Details**: Get detailed information about each event, including the name, date, time, and location.
- **Suggest Events**: Use the `/meetup_vorschlagen` command to add a new Meetup to the calendar.
  - **Admin Approval**: Suggested events are sent to admins for approval before being published.
- **Delete Meetup**: Send a NIP-09 event if you need to delete the meetup again.
  - **Admin Approval**: Suggested NIP-09 events are sent to admins for approval before being published.
- **Community Links**: Use the `/links` command to view important community resources and links.
- **Shitcoin Alarm**: Mention a shitcoin and find out what happens.
- **Tracking link cleaner**: Clean up tracking links and display nitter-links for twitter posts.
- **Welcome-Messages**: Send welcome messages in predefined chat-groups.
- **Event Logging**: All event creation, approval, rejection, and deletion actions are logged to a designated logs channel for audit and monitoring purposes.

## Feature Requests and Bug Reports

For feature requests or bug reports, please use one of the following methods:

- **GitHub**: Open an issue in this repository.
- **Telegram**: Contact [@g1ll0hn3r](https://t.me/g1ll0hn3r).
- **Nostr**: Reach out via Nostr (https://njump.me/riginode.xyz)

## Setup Instructions

To set up the Dezentralschweiz Bot, follow these steps:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/gillohner/dezentralschweiz_bot.git
   cd dezentralschweiz-bot
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Configure Environment Variables**

   Configure Environment Variables Create a .env file in the root directory of your project and add the following environment variables:

   ```text
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   NADDR_LIST=comma_separated_list_of_event_kinds_31924
   DEFAULT_RELAYS=your_post_relays_here
   ADMIN_CHAT_ID=your_admin_chat_id_here
   LOGS_CHAT_ID=your_logs_chat_id_here
   BOT_NSEC=your_bot_private_key_here
   EVENT_CALENDAR_NADDR=your_event_calendar_naddr_here
   ```

4. **Run the Bot**
   ```bash
   node bot.js
   ```

## Admin Features

- Admins can approve or reject suggested events through the admin chat.
- Approved events are automatically added to the community calendar and published to Nostr relays

## Contributing

Contributions to the Dezentralschweiz Bot are welcome! Please feel free to submit pull requests or open issues for any improvements or bug fixes.

## License

GPL 3.0

# Dezentralschweiz Bot

The **Dezentralschweiz Bot** is a Telegram bot designed to provide users with information about upcoming meetups in the [Dezentralschweiz](https://dezentralschweiz.ch/) community. It fetches events from various relays using the Nostr protocol and displays them in a user-friendly format.

## Features

- **Fetch Upcoming Meetups**: Use the `/meetups` command to retrieve a list of upcoming events.
- **Event Details**: Get detailed information about each event, including the name, date, time, and location.
- **Direct Links**: Access direct links to event pages for more information.
- **Community Links**: Use the `/links` command to view important community resources and links.
- **Suggest Events**: Use the `/event_vorschlagen` command to suggest new events for the community.
- **Admin Approval**: Suggested events are sent to admins for approval before being published.
- **Automatic Calendar Updates**: Approved events are automatically added to the community calendar.

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

2. **Install Dependencies**
   ```bash
   npm install
3. **Configure Environment Variables**

   Configure Environment Variables Create a .env file in the root directory of your project and add the following environment variables:

    ```text
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   NADDR_LIST=comma_separated_list_of_event_kinds_31924
   DEFAULT_RELAYS=wss://nos.lol,wss://relay.damus.io,wss://relay.nostr.band,wss://relay.riginode.xyz
   ADMIN_CHAT_ID=your_admin_chat_id_here
   BOT_NSEC=your_bot_private_key_here
   EVENT_CALENDAR_NADDR=your_event_calendar_naddr_here
3. **Run the Bot**
   ```bash
   node bot.js
## Usage
- Start a chat with your bot on Telegram.
- Use /start to receive a welcome message.
- Use /meetups to fetch and display upcoming meetups.

## Admin Features
- Admins can approve or reject suggested events through the admin chat.
- Approved events are automatically added to the community calendar and published to Nostr relays

## Contributing
Contributions to the Dezentralschweiz Bot are welcome! Please feel free to submit pull requests or open issues for any improvements or bug fixes.

## License
Intelectual property is a joke. Do whatever the fuck you want with this.
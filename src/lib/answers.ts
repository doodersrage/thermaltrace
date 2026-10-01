/**
 * Answer-first pages for the questions people ask search engines and AI
 * assistants about freeze alarms. Each opens with a direct answer that can be
 * quoted on its own, then the detail. Keep claims sourced and product mentions
 * honest (competitors included where they are the better fit).
 */
export type Answer = {
  slug: string;
  path: string;
  /** The question, used as the h1. */
  question: string;
  /** Under 160 characters. */
  description: string;
  /** Two or three sentences that fully answer the question. */
  shortAnswer: string;
  datePublished: string;
  /** Set when the answer is meaningfully revised. */
  dateModified?: string;
  sections: Array<{ heading: string; paragraphs: string[]; code?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  related: Array<{ label: string; href: string }>;
  sources?: Array<{ label: string; url: string }>;
};

export const answers: Answer[] = [
  {
    slug: "garage-pipe-freeze-temperature",
    path: "/answers/garage-pipe-freeze-temperature",
    question: "At what temperature do pipes freeze in a garage?",
    description:
      "Water freezes at 32°F, but garage pipes usually freeze when it drops to about 20°F outside. Why, what speeds it up, and where to set an alert.",
    shortAnswer:
      "Water freezes at 32°F, but pipes rarely freeze the moment the air reaches 32°F. University of Illinois research found uninsulated pipes in unheated spaces start to freeze when it drops to about 20°F outside, and a garage usually stays a few degrees warmer than outdoors. What matters is the temperature at the pipe, so set an alert for 34–38°F there to leave time to act.",
    datePublished: "2026-09-28",
    sections: [
      {
        heading: "Why 32°F is not the whole story",
        paragraphs: [
          "A pipe has to lose heat for a while before the water in it freezes, and water can cool a few degrees below 32°F before ice starts to form. Short dips below freezing often pass without harm; a long, cold night does not.",
          "The burst usually is not where the ice forms. Ice blocks the pipe, and pressure builds between the blockage and a closed faucet until the pipe splits there.",
        ],
      },
      {
        heading: "What makes garage pipes freeze sooner",
        paragraphs: [
          "Pipes on exterior walls, near the overhead door, or in drafty corners get much colder than the middle of the garage. Wind through gaps can freeze an exposed pipe even when it is above 20°F outside.",
          "An open or poorly sealed garage door, a heater that trips its breaker, and missing pipe insulation are the usual causes when a garage pipe freezes.",
        ],
      },
      {
        heading: "How to know before it happens",
        paragraphs: [
          "Measure at the pipe, not in the middle of the room: a waterproof probe (such as a DS18B20) against the coldest pipe run tells you what the pipe is experiencing.",
          "Alert a few degrees above 32°F so there is time to close a door, reset a heater, or open a faucet. A forecast warning the day before a hard freeze adds even more lead time.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can pipes freeze at 32°F?",
        answer:
          "Yes, if the pipe itself stays at or below 32°F long enough, especially with wind or no insulation. Most freezes happen on long nights well below freezing, which is why the outdoor 20°F figure is a useful warning sign.",
      },
      {
        question: "Does an attached garage protect pipes from freezing?",
        answer:
          "Not reliably. Attached garages are often unheated and their exterior walls and doors can get almost as cold as outdoors on a windy night.",
      },
      {
        question: "What temperature should a garage be kept at to protect pipes?",
        answer:
          "Keeping the air around the pipes above freezing is the goal; many people aim for 40°F or more in a garage with plumbing and alert if it drops toward 34–38°F.",
      },
    ],
    related: [
      { label: "What temperature should a freeze alarm be set to?", href: "/answers/freeze-alarm-temperature-setting" },
      { label: "How long does it take for pipes to freeze?", href: "/answers/how-long-for-pipes-to-freeze" },
      { label: "ESP32 freeze kit parts list", href: "/about/esp32-freeze-kit" },
      { label: "Garage heater failure scenario", href: "/stories/garage-freeze-alert" },
    ],
    sources: [
      { label: "At what temperature do pipes freeze? (KXAN, citing University of Illinois research)", url: "https://www.kxan.com/weather/weather-blog/at-what-temperature-do-pipes-freeze/" },
      { label: "How pipes freeze and burst (Farm Bureau Insurance)", url: "https://www.scfbins.com/articles/how-pipes-freeze-and-burst" },
    ],
  },
  {
    slug: "freeze-alarm-temperature-setting",
    path: "/answers/freeze-alarm-temperature-setting",
    question: "What temperature should a freeze alarm be set to?",
    description:
      "Set a freeze alarm to 34–38°F measured at the pipe. When to go lower or higher, and how to avoid false alarms without losing warning time.",
    shortAnswer:
      "Set it to 34–38°F if the sensor is on or next to the pipe. Go toward 34°F if you can respond within an hour; go toward 38–40°F if the sensor measures room air away from the pipes or it takes you hours to get there, like an empty cabin.",
    datePublished: "2026-09-28",
    sections: [
      {
        heading: "The trade-off: warning time vs false alarms",
        paragraphs: [
          "A higher threshold gives you more time but fires on cold nights when nothing is wrong. A lower threshold is quieter but leaves less time between the alert and a frozen pipe.",
          "Start at 36°F. If it fires on normal nights, move the probe closer to the pipe before you lower the number; the reading at the pipe is what matters.",
        ],
      },
      {
        heading: "Adjust for how far away you are",
        paragraphs: [
          "At home, 34–36°F is usually enough: you can close a door or reset a heater in minutes.",
          "For a cabin, rental, or vacant house, use 38–40°F and add a second person who can respond, because someone has to drive there.",
        ],
      },
      {
        heading: "Add a forecast warning",
        paragraphs: [
          "A threshold alert tells you it is getting cold now. A forecast warning tells you the day before that tonight is going to be dangerous, which is when to check the heater and close things up.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is 32°F a good freeze alarm setting?",
        answer:
          "It is too late for most setups. By the time the air near the sensor reads 32°F, a colder pipe elsewhere may already be freezing, and you have no time left to respond.",
      },
      {
        question: "Why does my freeze alarm go off when nothing is wrong?",
        answer:
          "Usually the sensor is near a door, window, or vent that swings colder than the pipes. Move it next to the pipe you care about, or add a short delay so brief dips do not alert.",
      },
    ],
    related: [
      { label: "At what temperature do pipes freeze in a garage?", href: "/answers/garage-pipe-freeze-temperature" },
      { label: "Where should a crawlspace freeze sensor go?", href: "/answers/crawlspace-freeze-sensor-placement" },
      { label: "Freeze season checklist", href: "/freeze-season" },
    ],
  },
  {
    slug: "crawlspace-freeze-sensor-placement",
    path: "/answers/crawlspace-freeze-sensor-placement",
    question: "Where should a freeze sensor go in a crawlspace?",
    description:
      "Put a crawlspace freeze sensor on the coldest water supply line, usually near vents or where pipes enter, not at the access hatch. How to mount it.",
    shortAnswer:
      "On or right next to the coldest water supply line, not at the access hatch. That is usually near a foundation vent, along the rim joist on the windward side, or where the supply line comes through the foundation. A waterproof probe taped to the pipe measures what the pipe actually feels.",
    datePublished: "2026-09-28",
    sections: [
      {
        heading: "Find the coldest pipe",
        paragraphs: [
          "Cold air enters through vents, gaps at the rim joist, and around the pipe penetration. The supply line nearest those spots freezes first.",
          "If you are not sure, put two probes out for a week and compare them on a cold night; the one that dips first is where the sensor belongs.",
        ],
      },
      {
        heading: "How to mount it",
        paragraphs: [
          "Use a waterproof probe such as a DS18B20 on a cable. Tape it to the pipe and wrap the pipe insulation back over it so it reads the pipe, not the air.",
          "Keep the board and power supply off the ground in a dry spot; crawlspaces get damp. A second probe in the open air is useful context.",
        ],
      },
      {
        heading: "Add a leak contact while you are down there",
        paragraphs: [
          "A wet/dry contact on the floor under the main line catches a slow leak or a thaw after a freeze, which is often when the damage shows up.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is a crawlspace humidity sensor enough to catch freezing?",
        answer:
          "No. Humidity helps spot moisture problems, but freeze risk is the temperature at the pipe. Use a temperature probe on the pipe.",
      },
      {
        question: "Should crawlspace vents be closed in winter?",
        answer:
          "In freezing climates, many homeowners close or cover foundation vents for winter to keep cold air off the pipes. A stuck-open vent is a common cause of crawlspace freezes.",
      },
    ],
    related: [
      { label: "Crawlspace vent scenario", href: "/stories/crawlspace-pipe-watch" },
      { label: "DS18B20 or DHT22: which sensor is better for freeze monitoring?", href: "/answers/ds18b20-vs-dht22-freeze-sensor" },
      { label: "What temperature should a freeze alarm be set to?", href: "/answers/freeze-alarm-temperature-setting" },
      { label: "ESP32 freeze kit parts list", href: "/about/esp32-freeze-kit" },
    ],
  },
  {
    slug: "home-assistant-freeze-alert",
    path: "/answers/home-assistant-freeze-alert",
    question: "How do I set up a freeze alert in Home Assistant?",
    description:
      "A Home Assistant freeze alert is one automation: trigger when a temperature sensor stays below 35°F for 10 minutes, then notify your phone. YAML inside.",
    shortAnswer:
      "Create an automation with a numeric state trigger on your temperature sensor, below 35°F for 10 minutes, and a notify action to your phone. The catch: if Home Assistant or your home internet is down, the alert never goes out, so pair it with something that notices when readings stop.",
    datePublished: "2026-09-28",
    sections: [
      {
        heading: "The automation",
        paragraphs: [
          "Replace the sensor and notify service with your own. The 10-minute delay stops a brief draft from alerting. This assumes Home Assistant is set to °F; use about 2°C if it is in Celsius.",
        ],
        code: `automation:
  - alias: Garage freeze warning
    triggers:
      - trigger: numeric_state
        entity_id: sensor.garage_temperature
        below: 35
        for: "00:10:00"
    actions:
      - action: notify.mobile_app_your_phone
        data:
          title: Freeze warning
          message: "Garage is {{ states('sensor.garage_temperature') }}°"`,
      },
      {
        heading: "The weak spot: when Home Assistant is the thing that fails",
        paragraphs: [
          "A power cut or internet outage is often what lets a space get cold, and it also takes Home Assistant or its connection offline. The automation cannot warn you about the outage that disables it.",
          "An off-site service covers that gap. ThermalTrace, for example, can receive the same readings from Home Assistant and alerts you both when it gets cold and when readings stop arriving. On Devices → Setup, choosing Home Assistant generates the YAML with your key.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Home Assistant send a text message for a freeze alert?",
        answer:
          "Yes, through a notify integration for an SMS provider such as Twilio, or through the companion app for push notifications.",
      },
      {
        question: "Which sensor should Home Assistant use for freeze alerts?",
        answer:
          "Any temperature sensor near the pipes works: ESPHome with a DS18B20, a Zigbee sensor, or a Wi-Fi sensor with an integration. Placement near the coldest pipe matters more than the brand.",
      },
    ],
    related: [
      { label: "ThermalTrace Home Assistant integration", href: "/integrations/home-assistant" },
      { label: "How do I build a freeze alert with ESPHome?", href: "/answers/esphome-freeze-alert" },
      { label: "Will a Wi-Fi freeze alarm work during a power outage?", href: "/answers/wifi-freeze-alarm-power-outage" },
      { label: "What temperature should a freeze alarm be set to?", href: "/answers/freeze-alarm-temperature-setting" },
      { label: "MQTT bridge", href: "/about/mqtt-bridge" },
    ],
  },
  {
    slug: "freeze-alarm-without-subscription",
    path: "/answers/freeze-alarm-without-subscription",
    question: "Can I get a freeze alarm without a monthly subscription?",
    description:
      "Yes. Temp Stick, Govee, Home Assistant, and ThermalTrace's free plan all alert without a subscription. What each costs and what you give up.",
    shortAnswer:
      "Yes. Temp Stick sells finished sensors ($149 and up) with free text, email, and app alerts. Govee's Wi-Fi sensors (about $35–50 with the gateway) send app alerts. Home Assistant is free if you run it yourself, and ThermalTrace's free plan sends email and chat alerts from a DIY sensor. SMS on ThermalTrace needs the Pro plan.",
    datePublished: "2026-09-28",
    sections: [
      {
        heading: "The options",
        paragraphs: [
          "Temp Stick: a finished battery Wi-Fi sensor. The most expensive per sensor, but no setup and no fees, and it includes text alerts.",
          "Govee: cheap Wi-Fi gateway plus sensors with app notifications. Fine for a room; check that alerts reach you reliably away from home.",
          "Home Assistant: free and flexible if you already run it, but it depends on your home internet and power staying up (see the Home Assistant freeze alert answer).",
          "ThermalTrace: about $25 of DIY parts per probe, free email, chat, and push alerts, leak contacts, and history. SMS and longer history are on paid plans.",
        ],
      },
      {
        heading: "What to weigh",
        paragraphs: [
          "Setup: finished sensors win. Cost per zone: DIY probes win once you want several. Getting woken up at night: SMS or push matters more than email, so check which plan includes it.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Temp Stick charge a monthly fee?",
        answer:
          "No. Temp Stick says monitoring, data history, and text, email, and app alerts are free for the life of the sensor.",
      },
      {
        question: "Is ThermalTrace free?",
        answer:
          "There is a free plan with email and chat alerts, a week of history, and up to two devices. Member and Pro add history, CSV export, forecast warnings, and SMS.",
      },
    ],
    related: [
      { label: "ThermalTrace vs Temp Stick", href: "/compare/tempstick" },
      { label: "ThermalTrace vs Govee", href: "/compare/govee" },
      { label: "Plans and pricing", href: "/pricing" },
    ],
    sources: [
      { label: "Temp Stick common questions", url: "https://tempstick.com/common-questions/" },
      { label: "GoveeLife Smart Thermometer R1", url: "https://us.govee.com/products/goveelife-smart-thermometer-r1" },
    ],
  },
  {
    slug: "how-long-for-pipes-to-freeze",
    path: "/answers/how-long-for-pipes-to-freeze",
    question: "How long does it take for pipes to freeze?",
    description:
      "There is no fixed number: pipes need hours of sustained cold, usually with outdoor temperatures near 20°F or lower. What shortens it and how to see it coming.",
    shortAnswer:
      "There is no single number. Pipes freeze after hours of sustained cold, not the moment it hits 32°F, and field research found uninsulated pipes in unheated spaces start freezing once it is about 20°F or colder outside. Wind, drafts, and missing insulation shorten the time; a brief dip below freezing usually passes without harm. How fast the temperature at the pipe is falling tells you more than any rule of thumb.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "What decides how fast a pipe freezes",
        paragraphs: [
          "How cold it is and for how long: a long night in the teens is far more dangerous than an hour at 30°F.",
          "Air movement: research at the University of Illinois found that wind and drafts through gaps in a wall play a major role in speeding up ice blockage, so an exposed pipe in a drafty corner can freeze when it is above 20°F outside.",
          "Insulation, pipe size, and whether water is moving: a small, bare pipe with still water in it freezes first.",
        ],
      },
      {
        heading: "Estimate it from the cooling rate",
        paragraphs: [
          "If the air at the pipe is 44°F and falling 2°F an hour, it reaches 34°F in about five hours. That simple estimate, redone as new readings arrive, is more useful than a generic figure because it reflects your space on that night.",
          "ThermalTrace shows this as a time-to-freeze clock on every plan: hours until your freeze threshold at the current cooling rate.",
        ],
      },
      {
        heading: "What to do with the time you have",
        paragraphs: [
          "Close the garage door, restore heat, open cabinet doors under sinks, and let a faucet on the exposed line drip. If you are away, this is when a neighbor with a key matters.",
        ],
      },
    ],
    faqs: [
      {
        question: "Will pipes freeze in one night?",
        answer:
          "They can. A single long night with outdoor temperatures in the teens or lower is enough for an uninsulated pipe in an unheated garage, crawlspace, or attic.",
      },
      {
        question: "Do pipes freeze faster when it is windy?",
        answer:
          "Yes. Moving air strips heat from a pipe much faster than still air, which is why pipes near vents, door gaps, and cracks in exterior walls freeze first.",
      },
    ],
    related: [
      { label: "At what temperature do pipes freeze in a garage?", href: "/answers/garage-pipe-freeze-temperature" },
      { label: "Pipe freeze time calculator", href: "/freeze-time-calculator" },
      { label: "Time-to-freeze explained", href: "/about/time-to-freeze" },
      { label: "Should I let faucets drip to prevent frozen pipes?", href: "/answers/drip-faucets-to-prevent-frozen-pipes" },
    ],
    sources: [
      { label: "How pipes freeze and burst (Farm Bureau Insurance, citing University of Illinois research)", url: "https://www.scfbins.com/articles/how-pipes-freeze-and-burst" },
    ],
  },
  {
    slug: "vacant-house-winter-thermostat-setting",
    path: "/answers/vacant-house-winter-thermostat-setting",
    question: "What temperature should I leave my house at in winter when I am away?",
    description:
      "Leave the heat on, set no lower than 55°F, per the American Red Cross. Why 55°F is not a guarantee, and how to know if the heat fails while you are gone.",
    shortAnswer:
      "Leave the heat on and set it no lower than 55°F; that is the American Red Cross recommendation for going away in cold weather. The thermostat only tells you about the room it is in, though. Pipes in a garage, crawlspace, or exterior wall can be much colder, and the setting does nothing if the furnace or the power fails, so someone or something needs to be watching.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Why 55°F and not lower",
        paragraphs: [
          "The house loses heat toward its edges. With the living space at 55°F, pipes in exterior walls and unheated areas still have some margin above freezing. Set it to 45°F and that margin is gone on a very cold, windy night.",
          "Open the cabinet doors under kitchen and bathroom sinks before you leave so warmer room air reaches the plumbing, and keep the garage door closed if there are water lines in the garage.",
        ],
      },
      {
        heading: "The setting does not help if the heat stops",
        paragraphs: [
          "A tripped furnace, an empty propane or oil tank, or a power cut lets the house cool toward the outdoor temperature no matter what the thermostat says.",
          "Put a temperature sensor where the pipes are, alert at 38–40°F so there is time for someone to get there, and make sure a second person receives the alert. An alert that fires when the sensor stops reporting covers power and internet outages.",
        ],
      },
      {
        heading: "For a long absence",
        paragraphs: [
          "If a house will sit empty for weeks, shutting off the water at the main and draining the lines removes most of the risk; a plumber can winterize it properly. Keep the heat on anyway to protect the building and anything that cannot be drained.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is 50°F warm enough to keep pipes from freezing?",
        answer:
          "Often, but it leaves less margin than the 55°F the American Red Cross recommends. The colder the climate and the more plumbing you have in exterior walls or unheated spaces, the more that margin matters.",
      },
      {
        question: "Should I turn the heat off to save money while away?",
        answer:
          "No, not in freezing weather. The Red Cross advice is to leave the heat on; a burst pipe costs far more than the heating bill.",
      },
    ],
    related: [
      { label: "How can I monitor the temperature in a cabin remotely?", href: "/answers/remote-cabin-temperature-monitoring" },
      { label: "What temperature should a freeze alarm be set to?", href: "/answers/freeze-alarm-temperature-setting" },
      { label: "Freeze season checklist", href: "/freeze-season" },
    ],
    sources: [
      { label: "Frozen pipes: prevention and thawing (American Red Cross)", url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/winter-storm/frozen-pipes.html" },
    ],
  },
  {
    slug: "drip-faucets-to-prevent-frozen-pipes",
    path: "/answers/drip-faucets-to-prevent-frozen-pipes",
    question: "Should I let faucets drip to prevent frozen pipes?",
    description:
      "Yes, in very cold weather: let cold water drip from faucets served by exposed pipes. Which faucets, how much, and what a drip cannot do.",
    shortAnswer:
      "Yes. When it is very cold, let cold water drip from the faucets served by exposed pipes; the American Red Cross notes that running water, even at a trickle, helps keep pipes from freezing. You only need to do it for faucets fed by pipes in unheated spaces or exterior walls, not every tap in the house.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Why a drip helps",
        paragraphs: [
          "Moving water brings warmer water from the main into the cold section of pipe, which slows freezing.",
          "It also relieves pressure. Pipes usually burst because ice blocks the line and pressure builds between the blockage and a closed faucet. An open faucet gives that pressure somewhere to go.",
        ],
      },
      {
        heading: "Which faucets, and how much",
        paragraphs: [
          "Pick the faucets at the end of pipe runs through a garage, crawlspace, attic, or exterior wall. A steady drip or pencil-lead trickle is enough.",
          "If a faucet has separate hot and cold lines that both run through the cold space, open both slightly.",
        ],
      },
      {
        heading: "What a drip will not do",
        paragraphs: [
          "It will not save a pipe in a space that stays far below freezing for days, and it does not help while you are away with nobody to open the tap. Insulating the pipe, sealing drafts, and keeping the space above freezing are the real fixes; a temperature alert tells you when it is time to open the faucet.",
        ],
      },
    ],
    faqs: [
      {
        question: "At what temperature should I start dripping faucets?",
        answer:
          "A common trigger is a forecast low around 20°F or colder, the point where research found uninsulated pipes in unheated spaces begin to freeze. Start earlier if the pipe is in a drafty spot.",
      },
      {
        question: "Does dripping faucets waste a lot of water?",
        answer:
          "A slow drip uses little water, and you only need it on the handful of nights cold enough to threaten the pipe. That is small next to the cost of a burst pipe.",
      },
    ],
    related: [
      { label: "How long does it take for pipes to freeze?", href: "/answers/how-long-for-pipes-to-freeze" },
      { label: "How do I thaw a frozen pipe safely?", href: "/answers/how-to-thaw-frozen-pipes" },
      { label: "Cold-snap alert playbook", href: "/about/cold-snap-playbook" },
    ],
    sources: [
      { label: "Frozen pipes: prevention and thawing (American Red Cross)", url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/winter-storm/frozen-pipes.html" },
      { label: "How pipes freeze and burst (Farm Bureau Insurance)", url: "https://www.scfbins.com/articles/how-pipes-freeze-and-burst" },
    ],
  },
  {
    slug: "how-to-thaw-frozen-pipes",
    path: "/answers/how-to-thaw-frozen-pipes",
    question: "How do I thaw a frozen pipe safely?",
    description:
      "Keep the faucet open and warm the pipe with a hair dryer, heating pad, or hot towels. Never use an open flame. Steps, and when to call a plumber.",
    shortAnswer:
      "Keep the faucet open, then warm the frozen section with an electric hair dryer, an electric heating pad, a space heater kept away from anything flammable, or towels soaked in hot water. Never use a blowtorch or any open flame. Keep applying heat until full water pressure returns, and call a licensed plumber if you cannot find or reach the frozen section. These steps follow American Red Cross guidance.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Find the frozen section",
        paragraphs: [
          "If a faucet gives only a trickle in cold weather, suspect a frozen pipe. The likely spots are against exterior walls and where the water service enters the house through the foundation.",
          "Check the other faucets too. If one pipe froze, others may have.",
        ],
      },
      {
        heading: "Thaw it",
        paragraphs: [
          "Leave the faucet open. As the ice melts, water starts to flow, and running water helps melt the rest.",
          "Apply gentle heat to the pipe: a hair dryer, an electric heating pad wrapped around it, a portable space heater, or hot wet towels. Do not use a blowtorch, a kerosene or propane heater, a charcoal stove, or any other open flame.",
        ],
      },
      {
        heading: "Watch for a leak as it thaws",
        paragraphs: [
          "A pipe that split while frozen often does not leak until the ice melts. Know where your main shutoff is before you start, and look along the pipe once water is flowing.",
          "This is where a leak sensor on the floor under the vulnerable run earns its keep: the freeze alert tells you about the cold, and the leak alert tells you about the thaw.",
        ],
      },
    ],
    faqs: [
      {
        question: "Will a frozen pipe thaw on its own?",
        answer:
          "Eventually, once the space warms up, but waiting leaves pressure in the line and you may not be there when a split pipe starts leaking. Thawing it deliberately with the faucet open is safer.",
      },
      {
        question: "Does a frozen pipe always burst?",
        answer:
          "No. Many frozen pipes thaw without damage. The risk comes from pressure trapped between the ice and a closed faucet, which is why the faucet should stay open.",
      },
    ],
    related: [
      { label: "Freeze then thaw flood playbook", href: "/about/freeze-thaw-flood-playbook" },
      { label: "Where should water leak sensors be placed?", href: "/answers/water-leak-sensor-placement" },
      { label: "Should I let faucets drip to prevent frozen pipes?", href: "/answers/drip-faucets-to-prevent-frozen-pipes" },
    ],
    sources: [
      { label: "Frozen pipes: prevention and thawing (American Red Cross)", url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/winter-storm/frozen-pipes.html" },
      { label: "How pipes freeze and burst (Farm Bureau Insurance)", url: "https://www.scfbins.com/articles/how-pipes-freeze-and-burst" },
    ],
  },
  {
    slug: "wifi-freeze-alarm-power-outage",
    path: "/answers/wifi-freeze-alarm-power-outage",
    question: "Will a Wi-Fi freeze alarm work during a power outage?",
    description:
      "Usually not: a power cut takes down the router even if the sensor has batteries. How silence alerts, battery backup, and cellular sensors cover the gap.",
    shortAnswer:
      "Usually not. Even a battery-powered sensor needs your router and modem, and those go down with the power. The fix is a service that alerts you when the sensor goes quiet, because silence in winter is itself a warning: the same outage that stopped the readings has probably stopped the heat.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Why the alarm goes quiet when you need it",
        paragraphs: [
          "A freeze alert travels from the sensor, through your Wi-Fi and internet connection, to a server that sends the message. A power cut breaks that chain at the router, and a furnace needs electricity too, so the house starts cooling at the same moment the alarm stops reporting.",
          "Anything that only runs inside the house, including a Home Assistant automation, has the same weak spot.",
        ],
      },
      {
        heading: "Three ways to cover it",
        paragraphs: [
          "Alert on silence. A hosted service can notice that readings stopped and tell you. ThermalTrace has an outage alert that fires when a device has been silent for a set number of hours (two by default).",
          "Keep the network up. A small battery backup (UPS) on the modem, router, and sensor keeps readings flowing through short outages, as long as your internet provider's equipment outside the house stays powered.",
          "Skip the home network. A cellular sensor with a battery reports without Wi-Fi. It costs more and needs a data plan, but it is the right choice for a cabin or a house that loses power often.",
        ],
      },
      {
        heading: "Who gets the message",
        paragraphs: [
          "An outage often affects the whole neighborhood, including your own phone's Wi-Fi. Send alerts by SMS or push as well as email, and add a second person who can check on the house.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do battery-powered Wi-Fi temperature sensors work without power?",
        answer:
          "The sensor keeps measuring, but it cannot send anything until the router and internet connection are back. Some store readings and upload them later, which helps the record but not the warning.",
      },
      {
        question: "How long does a house take to get cold after the power goes out?",
        answer:
          "It depends on insulation and how cold it is outside. A sensor that was reporting until the outage gives you the last known temperature and cooling rate, which is a reasonable basis for deciding how urgently someone needs to go there.",
      },
    ],
    related: [
      { label: "How can I monitor the temperature in a cabin remotely?", href: "/answers/remote-cabin-temperature-monitoring" },
      { label: "Cellular ingest (Particle Boron)", href: "/about/cellular-ingest" },
      { label: "How do I set up a freeze alert in Home Assistant?", href: "/answers/home-assistant-freeze-alert" },
    ],
  },
  {
    slug: "remote-cabin-temperature-monitoring",
    path: "/answers/remote-cabin-temperature-monitoring",
    question: "How can I monitor the temperature in a cabin remotely?",
    description:
      "With internet at the cabin, a Wi-Fi sensor that alerts your phone. Without it, a cellular sensor. What to measure, where, and who should get the alert.",
    shortAnswer:
      "If the cabin has internet, put a Wi-Fi temperature sensor near the plumbing and have it alert your phone. If it does not, use a cellular sensor with its own data connection. Either way, alert early (38–40°F), alert when the sensor stops reporting, and include someone who lives close enough to get there.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Pick the connection first",
        paragraphs: [
          "Wi-Fi: the cheapest route if the cabin keeps an internet connection through winter. A finished sensor such as a Temp Stick works out of the box; a DIY ESP32 probe costs about $25 in parts and reports to a service like ThermalTrace.",
          "Cellular: for cabins with no internet or unreliable power. A battery-backed cellular board (ThermalTrace has a sketch for the Particle Boron) posts readings over the mobile network.",
        ],
      },
      {
        heading: "What to measure",
        paragraphs: [
          "Measure at the pipes, not just the living room: the pump or pressure tank area, the crawlspace, and the coldest bathroom or kitchen wall. A leak contact on the floor near the water heater or pump catches the thaw after a freeze.",
          "Add an alert for when readings stop. At an empty cabin, a silent sensor usually means the power or internet is out, and the heat may be out with it.",
        ],
      },
      {
        heading: "Plan for the drive",
        paragraphs: [
          "An alert at 34°F is too late if you are three hours away. Use 38–40°F, turn on a forecast warning so you hear about a hard freeze the day before, and give a nearby neighbor or caretaker their own alert and a key.",
          "If nobody can respond in winter, shut off and drain the water before you leave and monitor to protect the building rather than the plumbing.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I monitor a cabin without Wi-Fi?",
        answer:
          "Yes, with a cellular sensor. It uses the mobile network instead of the cabin's internet, so it needs coverage at the site and usually a small data plan.",
      },
      {
        question: "What temperature should a cabin be kept at in winter?",
        answer:
          "If the water is on, leave the heat on and set no lower than 55°F, which is the American Red Cross recommendation for a home you are away from.",
      },
    ],
    related: [
      { label: "Cabin winter watch scenario", href: "/stories/cabin-winter-watch" },
      { label: "What temperature should I leave my house at in winter when I am away?", href: "/answers/vacant-house-winter-thermostat-setting" },
      { label: "Will a Wi-Fi freeze alarm work during a power outage?", href: "/answers/wifi-freeze-alarm-power-outage" },
    ],
    sources: [
      { label: "Frozen pipes: prevention and thawing (American Red Cross)", url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/winter-storm/frozen-pipes.html" },
      { label: "Temp Stick common questions", url: "https://tempstick.com/common-questions/" },
    ],
  },
  {
    slug: "ds18b20-vs-dht22-freeze-sensor",
    path: "/answers/ds18b20-vs-dht22-freeze-sensor",
    question: "DS18B20 or DHT22: which sensor is better for freeze monitoring?",
    description:
      "The DS18B20: it comes as a sealed waterproof probe you can tape to a pipe, and several share one pin. The DHT22 adds humidity but only measures room air.",
    shortAnswer:
      "The DS18B20, for most freeze monitoring. Both are accurate to about ±0.5°C near freezing, but the DS18B20 is sold as a sealed waterproof probe on a cable that you can tape directly to a pipe, and several of them can share one microcontroller pin. Choose the DHT22 when you also want humidity and only need the air temperature of the room.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "The numbers",
        paragraphs: [
          "DS18B20: measures −55 to 125°C (−67 to 257°F), ±0.5°C accuracy from −10 to 85°C, runs on 3.0–5.5V, and uses the 1-Wire bus, so multiple probes can share one data pin, each with a unique ID.",
          "DHT22 (AM2302): measures −40 to 80°C at ±0.5°C and humidity from 0–100% at ±2% (±5% worst case), runs on 3.3–5.5V, and should be read no more often than every two seconds.",
        ],
      },
      {
        heading: "Why the probe form matters more than the spec",
        paragraphs: [
          "Freeze risk is the temperature at the pipe. A DS18B20 probe on a cable can sit under the pipe insulation in a damp crawlspace while the board stays somewhere dry. A DHT22 is a vented plastic case that measures the air around the board.",
          "With 1-Wire you can run one probe on the pipe and a second in open air from the same pin, which shows how much margin the pipe has.",
        ],
      },
      {
        heading: "When the DHT22 is the right pick",
        paragraphs: [
          "Use it where humidity matters as much as cold: a basement, a workshop with tools that rust, or a crawlspace moisture check. Many setups use both: a DS18B20 on the pipe and a DHT22 for the room.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does the DS18B20 need a resistor?",
        answer:
          "Yes. The 1-Wire data line needs a pull-up resistor to the supply voltage, commonly 4.7kΩ. Some breakout boards include it.",
      },
      {
        question: "Are both sensors accurate enough for a freeze alarm?",
        answer:
          "Yes. Half a degree Celsius is about 1°F, far smaller than the few degrees of margin you should leave between the alert threshold and 32°F.",
      },
    ],
    related: [
      { label: "ESP32 freeze kit parts list", href: "/about/esp32-freeze-kit" },
      { label: "Where should a freeze sensor go in a crawlspace?", href: "/answers/crawlspace-freeze-sensor-placement" },
      { label: "How do I build a freeze alert with ESPHome?", href: "/answers/esphome-freeze-alert" },
    ],
    sources: [
      { label: "Waterproof DS18B20 digital temperature sensor: technical specs (Adafruit)", url: "https://www.adafruit.com/product/381" },
      { label: "AM2302 / DHT22 datasheet (Aosong, hosted by Adafruit)", url: "https://cdn-shop.adafruit.com/datasheets/Digital+humidity+and+temperature+sensor+AM2302.pdf" },
    ],
  },
  {
    slug: "esphome-freeze-alert",
    path: "/answers/esphome-freeze-alert",
    question: "How do I build a freeze alert with ESPHome?",
    description:
      "Add a DS18B20 to an ESP32 with ESPHome's dallas_temp sensor, then alert through Home Assistant or post the readings to an off-site service. YAML inside.",
    shortAnswer:
      "Wire a waterproof DS18B20 probe to an ESP32, add ESPHome's one_wire and dallas_temp components, and tape the probe to the pipe. ESPHome only measures; the alert comes from whatever receives the reading, either a Home Assistant automation or an off-site service that the device posts to over HTTPS.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "The sensor",
        paragraphs: [
          "Connect the probe's data wire to a GPIO pin with a 4.7kΩ pull-up to 3.3V. With a single probe on the bus you do not need to specify its address. ESPHome reports in °C.",
        ],
        code: `one_wire:
  - platform: gpio
    pin: GPIO4

sensor:
  - platform: dallas_temp
    id: pipe_temp_c
    name: Garage pipe temperature
    update_interval: 60s`,
      },
      {
        heading: "Option 1: alert from Home Assistant",
        paragraphs: [
          "Once the device is adopted, the sensor appears in Home Assistant and a numeric state automation can notify your phone. This is the quickest route, but the alert depends on Home Assistant and your home internet staying up.",
        ],
      },
      {
        heading: "Option 2: post readings off-site",
        paragraphs: [
          "ESPHome's http_request component can POST each reading to a hosted service, which then handles alerts, history, and noticing when the device goes silent. ThermalTrace publishes a ready-made snippet at thermaltrace.dev/esphome/thermaltrace.yaml: create a push device, put its ingest URL in secrets.yaml, and point the snippet at your sensor ID.",
          "You can do both: keep the device in Home Assistant for local automations and post to an off-site service for the alerts that have to reach you.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can ESPHome send a notification by itself?",
        answer:
          "Not directly to your phone. It can call a Home Assistant action or make an HTTP request, so the notification comes from Home Assistant or from the service receiving the request.",
      },
      {
        question: "What threshold should the alert use?",
        answer:
          "34–38°F at the pipe, which is about 1–3°C in ESPHome's units. Use the higher end if it takes you a while to respond.",
      },
    ],
    related: [
      { label: "ESPHome and Shelly recipes", href: "/about/esphome-shelly-recipes" },
      { label: "How do I set up a freeze alert in Home Assistant?", href: "/answers/home-assistant-freeze-alert" },
      { label: "DS18B20 or DHT22: which sensor is better for freeze monitoring?", href: "/answers/ds18b20-vs-dht22-freeze-sensor" },
    ],
  },
  {
    slug: "water-leak-sensor-placement",
    path: "/answers/water-leak-sensor-placement",
    question: "Where should water leak sensors be placed?",
    description:
      "On the floor at the lowest point next to each water source: water heater, washing machine, under sinks, sump pit, and below pipes that could freeze.",
    shortAnswer:
      "On the floor at the lowest point next to each thing that can leak: the water heater, the washing machine, under kitchen and bathroom sinks, beside the sump pit, and below any pipe run that could freeze. Water follows the floor, so a sensor an inch uphill of the low spot can stay dry while the puddle grows.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Start with the highest-consequence spots",
        paragraphs: [
          "Water heater: in the drain pan if there is one, otherwise on the floor at the base.",
          "Washing machine and dishwasher: behind or beside the appliance near the supply hoses.",
          "Under sinks: at the back of the cabinet floor, below the supply valves and trap.",
          "Sump pit and floor drains: a sensor just above the normal high-water line tells you the pump has failed.",
        ],
      },
      {
        heading: "Add the freeze-prone runs",
        paragraphs: [
          "A pipe that splits while frozen leaks when it thaws, often hours after the cold alert. Put a leak contact on the floor below pipes in the garage, crawlspace, or along exterior walls so the thaw does not go unnoticed.",
        ],
      },
      {
        heading: "Mounting",
        paragraphs: [
          "The contacts must touch the floor, flat, at the low point. Pour a cup of water nearby once to see where it runs, and test the sensor with a damp cloth when you install it.",
          "ThermalTrace treats a wet leak sensor as an alert on every plan, with no rule to set up.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many leak sensors does a house need?",
        answer:
          "One per water source you would not notice quickly. For most homes that is four to six: water heater, washer, kitchen sink, a bathroom or two, and the sump or lowest floor drain.",
      },
      {
        question: "Can a leak sensor shut the water off?",
        answer:
          "A sensor alone only alerts. Shutting off the water takes a motorized valve on the main line that an automation or webhook triggers when the sensor gets wet.",
      },
    ],
    related: [
      { label: "Water heater pan leak scenario", href: "/stories/water-heater-pad-leak" },
      { label: "Leak puck", href: "/leak-puck" },
      { label: "How do I thaw a frozen pipe safely?", href: "/answers/how-to-thaw-frozen-pipes" },
    ],
  },
  {
    slug: "landlord-vacant-rental-freeze-monitoring",
    path: "/answers/landlord-vacant-rental-freeze-monitoring",
    question: "How can a landlord monitor a vacant rental for frozen pipes?",
    description:
      "Keep the heat at 55°F or higher, put a temperature sensor near the plumbing in each unit, and send alerts to whoever can get there first.",
    shortAnswer:
      "Leave the heat on at 55°F or higher, put an internet-connected temperature sensor near the plumbing in each vacant unit, and route alerts to the person who can get there fastest, not just to you. Add an alert for when a sensor stops reporting, since a vacant unit with the power or internet shut off is exactly the one that freezes.",
    datePublished: "2026-10-01",
    sections: [
      {
        heading: "Between tenants is the risky window",
        paragraphs: [
          "Nobody is there to notice a furnace that quit, and utilities are often being switched between accounts. Confirm heat and power stay on in your name before the tenant's service ends.",
          "If the unit will sit empty all winter, shutting off and draining the water removes most of the risk.",
        ],
      },
      {
        heading: "What to install",
        paragraphs: [
          "One sensor near the most exposed plumbing (often a kitchen or bath on an exterior wall, or the basement) and a leak contact by the water heater. The unit needs a working internet connection, or a cellular sensor if it has none.",
          "Alert at 38–40°F so there is time to send someone, and turn on forecast warnings so you can check the building the day before a hard freeze.",
        ],
      },
      {
        heading: "Managing several properties",
        paragraphs: [
          "Keep each property separate so an alert names the address, and give your maintenance contact their own alerts. A record of readings and alerts is also useful evidence for an insurance claim if something does go wrong.",
          "ThermalTrace's property management page describes how it handles multiple properties.",
        ],
      },
    ],
    faqs: [
      {
        question: "What temperature should a vacant rental be kept at?",
        answer:
          "No lower than 55°F while the water is on, following the American Red Cross recommendation for a home nobody is in.",
      },
      {
        question: "Can tenants be asked to help?",
        answer:
          "In occupied units, yes: ask tenants to keep the heat on when they travel and to report a furnace problem right away. Monitoring covers the cases where nobody is home to notice.",
      },
    ],
    related: [
      { label: "ThermalTrace for landlords and property managers", href: "/property-management" },
      { label: "Claims evidence pack", href: "/claims-pack" },
      { label: "What temperature should I leave my house at in winter when I am away?", href: "/answers/vacant-house-winter-thermostat-setting" },
    ],
    sources: [
      { label: "Frozen pipes: prevention and thawing (American Red Cross)", url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/winter-storm/frozen-pipes.html" },
    ],
  },
];

/**
 * Answers to link from another page: those that already link to `path`, then
 * `fallbackSlugs` to fill up to `limit`. Keeps cross-links two-way without a
 * second list to maintain.
 */
export function getAnswersRelatedTo(path: string, fallbackSlugs: string[] = [], limit = 3): Answer[] {
  const linking = answers.filter((a) => a.related.some((link) => link.href === path));
  const fallback = fallbackSlugs
    .map((slug) => getAnswer(slug))
    .filter((a): a is Answer => !!a && !linking.includes(a));
  return [...linking, ...fallback].slice(0, limit);
}

export function getAnswer(slug: string): Answer | undefined {
  return answers.find((a) => a.slug === slug);
}

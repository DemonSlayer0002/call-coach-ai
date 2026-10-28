export const PLAYBOOK = {
  "config": {
    "minActionConfidence": 0.35,
    "minMargin": 0.1,
    "actionMinScore": {
      "book_visit": 0.65
    }
  },
  "stages": [
    "No clear intent",
    "Exploring vehicles",
    "Evaluating a vehicle",
    "Wants a next step"
  ],
  "actions": {
    "ask_discovery_question": {
      "title": "Discover their needs",
      "tips": {
        "when": [],
        "always": [
          "Ask: “What will you use the vehicle for, and what matters most in your next one?”"
        ],
        "choices": [
          {
            "question": "qualification_gap",
            "option": "need",
            "text": "Ask: “What are you trying to accomplish, and what matters most?”"
          },
          {
            "question": "qualification_gap",
            "option": "timeline",
            "text": "Ask: “When would you ideally want this in place?”"
          },
          {
            "question": "qualification_gap",
            "option": "budget",
            "text": "Ask: “What spending range or constraints should we work within?”"
          },
          {
            "question": "qualification_gap",
            "option": "approval",
            "text": "Ask: “Who else will help make the decision?”"
          }
        ]
      }
    },
    "verify_vehicle": {
      "title": "Verify the vehicle",
      "tips": {
        "when": [],
        "always": [
          "Confirm the exact vehicle and check the current inventory record before answering. Do not invent availability, condition, mileage, or features."
        ]
      }
    },
    "explain_price": {
      "title": "Clarify the total price",
      "tips": {
        "when": [],
        "always": [
          "Ask: “Are you comparing the vehicle price or the complete out-the-door total?” Confirm the actual price, fees, and taxes before quoting."
        ]
      }
    },
    "discuss_trade": {
      "title": "Understand the trade-in",
      "tips": {
        "when": [],
        "always": [
          "Ask for the vehicle details and explain the appraisal process. Avoid promising a trade value before inspection."
        ]
      }
    },
    "explain_finance": {
      "title": "Explain the finance process",
      "tips": {
        "when": [],
        "always": [
          "Ask which finance questions they want answered. Explain the application process; a lender must determine approval and terms. Do not request SSN or account details on this coaching screen."
        ]
      }
    },
    "handle_objection": {
      "title": "Explore the concern",
      "tips": {
        "when": [],
        "always": [
          "Ask: “What is the main thing holding you back?” Reflect the concern and verify the answer before making a promise."
        ],
        "choices": [
          {
            "question": "objection_type",
            "option": "price",
            "text": "Ask: “Is the concern the total cost, cash flow, or the value you expect?” Clarify before offering any concession."
          },
          {
            "question": "objection_type",
            "option": "timing",
            "text": "Ask: “What would need to change for the timing to work?” Agree on a realistic next contact."
          },
          {
            "question": "objection_type",
            "option": "competitor",
            "text": "Ask: “Which part of their offer works better for you?” Compare verified terms without criticizing the competitor."
          },
          {
            "question": "objection_type",
            "option": "trust",
            "text": "Ask: “Which history or condition concern would you like to verify?” Offer the available report or an inspection; never claim a vehicle is accident-free without evidence."
          },
          {
            "question": "objection_type",
            "option": "fit",
            "text": "Ask: “Which requirement does this miss?” Check the requirement before claiming a fit."
          },
          {
            "question": "objection_type",
            "option": "authority",
            "text": "Ask: “Who else should be part of this decision, and what will matter to them?”"
          }
        ]
      }
    },
    "include_buyer": {
      "title": "Include the other buyer",
      "tips": {
        "when": [],
        "always": [
          "Ask: “Who else would you like involved, and what will matter most to them?” Offer a visit together."
        ]
      }
    },
    "book_visit": {
      "title": "Agree on a visit",
      "tips": {
        "when": [],
        "always": [
          "Offer two real visit times. Confirm the vehicle, day, time, and who will attend. Only call it booked after the customer agrees to a specific time."
        ]
      }
    },
    "agree_follow_up": {
      "title": "Agree on a follow-up",
      "tips": {
        "when": [],
        "always": [
          "Ask: “When would be useful for us to reconnect, and by phone or text?” Agree on a specific next contact."
        ]
      }
    },
    "no_action": {
      "title": "Keep listening",
      "tips": {
        "when": [],
        "always": [
          "Let the customer finish. A wrong number or technical problem is not a sales failure."
        ]
      }
    }
  },
  "priority": [
    "handle_objection",
    "verify_vehicle",
    "explain_finance",
    "explain_price",
    "discuss_trade",
    "include_buyer",
    "book_visit",
    "ask_discovery_question",
    "agree_follow_up",
    "no_action"
  ],
  "rules": [
    {
      "signal": "has_blocking_objection",
      "min": 0.7,
      "block": [
        "book_visit"
      ],
      "note": "Explore the unresolved concern before asking for a visit."
    }
  ],
  "listeningTips": [
    "Ask one open question, then give them time to answer.",
    "Verify vehicle facts and total pricing in the dealership’s current records."
  ],
  "alert": {
    "signal": "approval_promised",
    "min": 0.8,
    "title": "Clarify the financing promise",
    "text": "Explain that lender approval and terms must be confirmed. Do not repeat an unverified guarantee."
  },
  "copy": {
    "stageKicker": "Shopping stage",
    "idleStage": "Waiting for the customer",
    "other": "Customer",
    "rep": "You",
    "typeOther": "Type what the customer said",
    "idleTip": "Choose Auto capture for a browser call, or type the customer’s words. Use verified vehicle facts."
  },
  "signals": {
    "needs_known": {
      "label": "Vehicle needs stated"
    },
    "budget_known": {
      "label": "Budget constraint stated"
    },
    "timeline_known": {
      "label": "Purchase timing stated"
    },
    "buyer_involved": {
      "label": "Decision role stated"
    },
    "appointment_agreed": {
      "label": "Specific visit agreed"
    },
    "has_blocking_objection": {
      "label": "Unresolved concern",
      "warn": 0.6,
      "block": 0.7
    },
    "approval_promised": {
      "label": "Unverified finance guarantee",
      "warn": 0.6,
      "block": 0.8
    }
  },
  "sample": [
    [
      "customer",
      "Hi, I am looking for a used SUV for my family. We have two kids and need room for car seats."
    ],
    [
      "rep",
      "What matters most besides space, and when are you hoping to buy?"
    ],
    [
      "customer",
      "Safety is important. We need one this month, and I want to stay below twenty five thousand total."
    ],
    [
      "customer",
      "Is the SUV I saw on your website still available?"
    ],
    [
      "customer",
      "Can you explain all the fees and the out-the-door price?"
    ],
    [
      "customer",
      "My concern is the accident history. I would need to see a history report before coming in."
    ],
    [
      "rep",
      "I will check the exact vehicle and get the available history information for you."
    ],
    [
      "customer",
      "If the report checks out, my wife and I would like to test drive it. What times are open Saturday?"
    ]
  ]
};

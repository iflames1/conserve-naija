# Conserve Naija

**Keeping resources in circulation.**

Conserve Naija is an IoT-connected recycling incentive platform that connects citizens, recycling sites, machines, and recycling organisations.

The core idea is simple:

> A person brings recyclable waste to a Conserve Site, uses their phone to start a recycling session, connects that session to a machine, deposits their waste, and receives **Conserve Points (CP)** based on the material collected and its current value.

**1 Conserve Point (CP) = ₦1** for display and valuation purposes.

The platform is designed around the idea that the **physical machine is responsible for measuring what was actually deposited**. The application should never trust a phone-submitted weight or reward amount.

---

## Product Vision

Conserve Naija should feel like a modern recycling platform rather than a traditional waste-management dashboard.

The platform connects three sides of the ecosystem:

- **Citizens** who submit recyclable materials and earn CP.
- **Conserve Sites and their machines** where recyclable materials are collected and measured.
- **Recycling organisations and material buyers** that manage sites, materials, pricing, inventory, and collection.

The system should be extensible to multiple recyclable material types and multiple organisations.

Plastic may be the initial focus, but the domain must **never be designed around plastic specifically**.

Materials are data.

Prices are data.

Conserve Sites are data.

Machines are data.

The application should be able to support additional recyclable categories without redesigning the core system.

---

# Core Concepts

## Conserve Site

A **Conserve Site** is a physical location where people can bring recyclable materials.

A site may contain multiple machines, with each machine potentially handling one or more recyclable material categories.

Examples of material categories include:

- Plastic
- Paper & Cardboard
- Glass
- Metal
- E-waste
- Other recyclable categories in the future

The user should think of the physical location as the **Conserve Site**, not as "the machine".

Machines are equipment belonging to a site.

---

## Machine

A machine is an IoT device installed at a Conserve Site.

The machine is responsible for interacting with the physical recycling process.

Depending on the implementation, a machine may:

- Accept a recycling session code
- Identify the active session
- Receive or detect deposited material
- Measure weight
- Sort or classify material
- Report measurements to the backend
- Display the current state of the recycling process
- Report device health/heartbeat information

The backend remains responsible for validating measurements, calculating rewards, recording deposits, and updating inventory.

---

## Conserve Points

Citizens earn **Conserve Points (CP)** when a confirmed recycling deposit is completed.

The current valuation model is:

```text
CP = weight × material price
```

For example:

```text
2.5 kg plastic
× ₦100/kg
= ₦250
= 250 CP
```

The actual calculation should use precise weight and pricing data rather than accepting a reward amount from the client.

CP should be represented as a ledger rather than simply modifying a balance without history.

The system should maintain enough information to determine:

- How much CP a citizen has
- Why CP was awarded
- Which deposit generated the reward
- The material involved
- The weight
- The price used at the time
- When the transaction occurred

A CP redemption/payout system is **not currently part of the core product flow** and should not be assumed to exist during the rebuild.

---

# Core User Flow

The primary citizen experience is a recycling mission.

### 1. Start a recycling mission

The citizen opens the application and starts a recycling mission.

The backend creates a short-lived session and generates a **6-digit Conserve OTP**.

The OTP is temporary and intended to connect the citizen's phone session to a physical machine.

The initial waiting period should be approximately **2 minutes**.

---

### 2. Connect to a machine

The citizen enters the OTP on the machine.

The machine authenticates itself as a registered IoT device and submits the OTP to the backend.

The backend validates the session and binds it to the machine and its Conserve Site.

The session then becomes active.

The citizen should see the state of the mission update on their phone.

---

### 3. Recycling begins

The machine moves into the recycling process.

The machine may display stages such as:

```text
Waiting
Connected
Sorting
Measuring
Processing
Completed
```

The exact machine implementation can change, but the application should expose meaningful progress to the citizen.

---

### 4. Material is measured

The **machine is the source of truth for the physical measurement**.

The frontend must never be able to submit:

- Final weight
- CP reward amount
- Completed deposit status

The backend receives the machine measurement and validates it against:

- Known materials
- Materials accepted by the Conserve Site
- Current organisation pricing
- Valid weight ranges
- The active recycling session
- The authenticated machine

---

### 5. Deposit is confirmed

Once the measurement has been validated, the backend creates a confirmed deposit.

A confirmed deposit should contain enough information to reconstruct the transaction, including:

- Citizen
- Conserve Site
- Machine
- Material/fractions
- Weight
- Price at the time of deposit
- CP awarded
- Timestamp
- Recycling session

The original price should be **snapshotted** with the deposit.

Changing a material's current price later must not change the historical value of an existing deposit.

---

### 6. CP is awarded

The citizen's CP ledger is credited.

The application updates the citizen's balance and recycling statistics.

The citizen should receive immediate feedback that the recycling mission was completed successfully.

---

### 7. Inventory is updated

The material collected by the machine is added to the inventory of the Conserve Site.

Inventory should be tracked by material.

When inventory reaches a configured collection threshold, the system may create or mark a pickup as ready.

---

# Mixed Materials

The system should support a single recycling session containing multiple material fractions.

For example:

```text
Plastic       2.0 kg
Glass         1.0 kg
Paper         0.5 kg
```

Each fraction can have its own price.

The total CP is the sum of the value of all valid fractions.

For example:

```text
Plastic: 2.0 kg × ₦100 = 200 CP
Glass:   1.0 kg × ₦40  = 40 CP
Paper:   0.5 kg × ₦60  = 30 CP

Total = 270 CP
```

The domain should therefore model deposits and their material fractions separately rather than assuming one deposit always contains one material.

---

# Wokwi / IoT Simulation

The project should retain a **Wokwi-based machine simulation** as part of the development and demonstration experience.

The simulator represents a physical Conserve Site machine without requiring physical hardware.

The simulated machine should reproduce the important parts of the real device flow:

```text
Idle
  ↓
Enter Conserve OTP
  ↓
Connect to recycling session
  ↓
Receive/deposit material
  ↓
Measure / simulate sorting
  ↓
Send measurement to backend
  ↓
Show success
  ↓
Return to idle
```

The current simulation concept uses an ESP32-style device with components such as:

- Keypad
- LCD/display
- Weight input/simulation
- Material sorting simulation
- Network communication

The exact hardware simulation can change during the rebuild, but the **device protocol and domain behavior should remain representative of a real machine**.

The Wokwi machine should not contain business logic that belongs in the backend.

For example, the machine may simulate a measurement, but the backend should remain responsible for:

- Validating the measurement
- Looking up material prices
- Calculating CP
- Creating the deposit
- Updating inventory
- Creating pickup requirements

The long-term goal is that the simulated machine can eventually be replaced with a real IoT device without redesigning the application domain.

---

# Organisation Experience

Conserve Naija is not only a citizen application.

Recycling organisations should have an operational dashboard for managing their recycling network.

An organisation should be able to manage:

### Conserve Sites

- Create sites
- View sites
- Configure site status
- Configure accepted materials
- View site activity
- Monitor inventory

### Machines

- Register machines
- Associate machines with Conserve Sites
- Monitor machine health
- View last-seen/heartbeat information
- Disable machines when necessary

### Materials and Pricing

Organisations should be able to configure the materials they accept and the price paid for each material.

Prices should support historical records.

For example:

```text
Plastic
₦80/kg   → old price
₦100/kg  → current price
```

A deposit made while the price was ₦80/kg must remain valued at ₦80/kg even after the organisation changes the price to ₦100/kg.

### Inventory

Organisations should be able to see the recyclable material currently accumulated at each site.

Inventory should be tracked by material and weight.

### Pickups

When enough material has accumulated, the system can create a pickup requirement.

Organisations should be able to manage the pickup lifecycle, such as:

```text
Ready
Accepted
Completed
Cancelled
```

The exact operational workflow can evolve during the rebuild.

---

# Platform Administration

The platform should have an administrative layer separate from normal organisation operations.

Platform administrators should be able to manage the overall network, including:

- Organisations
- Conserve Sites
- Materials
- Organisation members
- Platform-level configuration

The system should distinguish between:

- Citizens
- Organisation members
- Organisation administrators
- Platform administrators
- IoT devices

Permissions should be enforced by the backend rather than relying only on frontend visibility.

---

# Real-Time Experience

The citizen experience should feel live.

Once a recycling mission starts, the application should not require the citizen to constantly refresh the page.

The backend should be capable of pushing session changes to the application.

Examples include:

```text
Waiting for machine
        ↓
Machine connected
        ↓
Sorting
        ↓
Measuring
        ↓
Processing
        ↓
Completed
```

When a deposit completes, the citizen should receive updated information such as:

- Deposit result
- CP earned
- Updated CP balance
- Updated recycled weight
- Updated deposit count

The exact real-time technology can change during the rebuild.

The important requirement is the **behavior**, not the implementation.

---

# Authentication and Trust Model

The platform has two fundamentally different types of authenticated clients.

## Human users

Citizens and organisation members authenticate through the web application.

The frontend should obtain an authenticated identity and communicate with the backend using secure authentication.

## IoT devices

Machines authenticate independently using a device credential.

A machine must never be able to impersonate another machine simply by providing a machine name.

Device credentials should be stored securely and should not be stored as plaintext in the database.

Disabled devices must not be allowed to perform recycling operations.

---

# Important Trust Boundary

One of the most important design decisions in Conserve Naija is:

> **The client reports intent. The machine reports physical measurements. The backend decides what is valid.**

The browser can request:

```text
"Start a recycling session."
```

The machine can report:

```text
"I measured 2.5 kg of plastic."
```

The backend decides:

```text
This machine is valid.
This session belongs to this machine.
This material is accepted here.
The current price is ₦100/kg.
The measurement is valid.
The citizen receives 250 CP.
```

The frontend should never be trusted to determine the financial result of a recycling event.

---

# Data Model Expectations

The rebuild should preserve the conceptual domain even if the database schema is redesigned.

The important entities are:

```text
User
Organisation
Organisation Member
Conserve Site
Machine / Device
Material
Material Price
Recycling Session
Deposit
Deposit Fraction
Conserve Point Transaction
Site Inventory
Pickup
Device Telemetry
```

Relationships should support:

```text
Organisation
    └── Conserve Sites
            ├── Machines
            ├── Accepted Materials
            ├── Material Inventory
            └── Pickups

Organisation
    └── Material Prices

Citizen
    └── Recycling Sessions
            └── Deposits
                    └── Material Fractions

Citizen
    └── CP Ledger
```

The exact database schema does not need to match the previous implementation.

The **domain relationships and business rules** are what should be preserved.

---

# Product UI Expectations

The rebuild should preserve the existing **visual language and product feel** of Conserve Naija.

This is a full technical rebuild, not a request to redesign the product from scratch.

The new implementation should retain the existing UI direction wherever practical:

- Clean and modern
- Friendly and approachable
- Calm visual hierarchy
- Recycling/environment-oriented without becoming overly decorative
- Mobile-first citizen experience
- Clear cards and sections
- Strong but restrained typography
- Simple navigation
- Clear status/progress feedback
- Mission-oriented recycling flow

The citizen experience should remain particularly simple.

A person standing beside a recycling machine should be able to understand what to do without needing to understand how the underlying system works.

The UI should prioritize:

```text
What do I do?
        ↓
What is happening?
        ↓
How much did I earn?
```

The organisation experience can be more information-dense because it is an operational interface.

Do not turn the citizen experience into an administration dashboard.

---

# Citizen Experience

The citizen application should support the core product journey:

```text
Landing
   ↓
Authentication
   ↓
Home
   ↓
Start Recycling
   ↓
Conserve OTP
   ↓
Machine Connection
   ↓
Live Recycling Mission
   ↓
Deposit Result
   ↓
CP Balance / Activity
```

The citizen should also be able to understand:

- What Conserve Naija is
- How recycling works
- Where Conserve Sites are located
- What materials are accepted
- Their recycling history
- Their CP balance
- Their recycling statistics

The product should not make users manually configure technical details such as machines or material measurements.

---

# Public Conserve Sites

Conserve Sites should be discoverable without requiring a citizen to already have an active recycling session.

A public site listing can provide information such as:

- Site name
- Location
- Organisation
- Accepted materials
- Availability/status
- Basic location information

The application may provide map/location functionality where appropriate.

The public site experience should describe the location as a **Conserve Site**, not as a machine.

---

# Business Rules to Preserve

The rebuild should preserve these important rules:

1. Recycling sessions use short-lived, single-use OTPs.
2. A machine must authenticate before claiming a session.
3. A session becomes associated with the machine and its Conserve Site.
4. Only an authenticated machine can submit an authoritative measurement.
5. The browser cannot submit a completed deposit.
6. The browser cannot determine the weight used for rewards.
7. The browser cannot determine the CP reward.
8. Materials accepted by a site must be validated by the backend.
9. Material pricing is organisation-specific.
10. Deposit pricing is snapshotted at the time of the deposit.
11. Deposits may contain multiple material fractions.
12. CP is calculated from measured weight and material price.
13. Completed deposits update both the CP ledger and site inventory.
14. Inventory can trigger pickup requirements.
15. Deposit creation must be idempotent so a repeated machine request cannot award CP twice.
16. Device telemetry and recycling deposits are separate concepts.
17. Disabled machines cannot perform recycling operations.
18. Historical deposits must not change when material prices change.

---

# Error and Failure Handling

The system should explicitly handle failures throughout the recycling process.

Examples include:

- Invalid OTP
- Expired OTP
- OTP already used
- Machine not registered
- Machine disabled
- Machine without an assigned Conserve Site
- Session already connected to another machine
- Unsupported material
- Inactive material
- Missing material price
- Invalid weight
- Duplicate measurement
- Failed processing
- Cancelled session

A failed recycling operation should not accidentally create a reward or partially corrupt inventory.

---

# Current Product Scope

The rebuild should focus on the complete core recycling loop:

```text
Citizen
   ↓
Recycling Session
   ↓
Conserve OTP
   ↓
IoT Machine
   ↓
Measurement
   ↓
Deposit
   ↓
CP Reward
   ↓
Inventory
   ↓
Pickup
```

The system should also include the operational experience required to manage that loop:

```text
Organisation
   ↓
Conserve Sites
   ↓
Machines
   ↓
Materials
   ↓
Prices
   ↓
Inventory
   ↓
Pickups
```

---

# Future Direction

The architecture should leave room for features such as:

- More recyclable material categories
- More Conserve Sites
- Multiple organisations
- Real physical machines
- More sophisticated material sorting
- Citizen rewards and CP redemption
- Recycling campaigns
- Citizen challenges
- Environmental impact statistics
- Organisation analytics
- Recycling material buyers/off-takers
- Commercial material collection workflows
- Additional IoT device types
- Automated machine monitoring

These features do not need to be fully implemented in the initial rebuild.

The important requirement is that the core domain should not prevent them from being added later.

---

# Rebuild Expectations

This repository represents a **full rebuild of Conserve Naija**, not a direct port of the previous implementation.

The previous implementation can be used as a reference for product behavior, but the new system should be designed cleanly rather than preserving old technical decisions simply for compatibility.

The rebuild should:

- Preserve the core product concept
- Preserve the recycling mission flow
- Preserve the Conserve Site concept
- Preserve the CP reward model
- Preserve the IoT trust boundary
- Preserve the Wokwi development/demo experience
- Preserve the existing UI style and overall product feel
- Improve the architecture where appropriate
- Keep the domain extensible
- Avoid carrying forward obsolete terminology such as treating machines as locations
- Avoid designing the domain around plastic
- Avoid coupling business logic to the frontend
- Avoid trusting client-provided measurements or rewards

The implementation technology, project structure, API design, database schema, authentication architecture, and infrastructure may be redesigned as part of the rebuild.

The goal is a **clean, production-oriented implementation of the same Conserve Naija product**, with the existing UI language and core user experience retained.

---

# Terminology

Use these terms consistently in the product:

| Term                            | Meaning                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| **Conserve Naija**              | The overall platform                                           |
| **Conserve Site**               | Physical recycling location                                    |
| **Machine**                     | IoT equipment installed at a Conserve Site                     |
| **Conserve OTP**                | Temporary code used to connect a citizen session to a machine  |
| **Recycling Session / Mission** | Active recycling interaction between citizen and machine       |
| **Deposit**                     | Confirmed recycling event                                      |
| **Material Fraction**           | Individual material component of a deposit                     |
| **Conserve Points / CP**        | Reward earned from confirmed recycling                         |
| **Inventory**                   | Recyclable material currently held at a site                   |
| **Pickup**                      | Collection of accumulated recyclable material                  |
| **Organisation**                | Entity operating recycling sites and managing materials/prices |

Avoid introducing "Green Points" in new product-facing code or UI. That is legacy terminology from the previous implementation.

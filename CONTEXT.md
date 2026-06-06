# Customers Context

This context manages customer registration and the welcome communication sent after a customer is created.

## Language

**Customer**:
A person registered in the system with identifying and contact information.
_Avoid_: Client, account, user

**Customer Creation**:
The accepted registration of a new **Customer**.
_Avoid_: Insert, cadastro

**Welcome Email Delivery**:
The attempt to send the welcome communication after **Customer Creation**.
_Avoid_: Delivery, event delivery

## Relationships

- A **Customer Creation** concerns exactly one **Customer**
- A **Customer Creation** may trigger one or more **Welcome Email Delivery** attempts

## Example dialogue

> **Dev:** "When a **Customer Creation** succeeds, does that mean the **Welcome Email Delivery** also succeeded?"
> **Domain expert:** "No. The customer can be created successfully even if the welcome email fails and needs another attempt."

## Flagged ambiguities

- "entrega" was used to mean both customer creation success and welcome email delivery outcome — resolved: **Customer Creation** and **Welcome Email Delivery** are distinct outcomes.

import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "email or phoneNumber required" });
  }

  // Find all contacts matching email or phoneNumber
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        email ? { email } : undefined,
        phoneNumber ? { phoneNumber } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { createdAt: "asc" },
  });

  let primaryContact = contacts.find((c) => c.linkPrecedence === "primary");
  if (!primaryContact && contacts.length > 0) {
    primaryContact = contacts[0];
  }

  // If no contacts found, create a new primary contact
  if (!primaryContact) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "primary",
      },
    });
    return res.json({
      contact: {
        primaryContatctId: newContact.id,
        emails: [newContact.email].filter(Boolean),
        phoneNumbers: [newContact.phoneNumber].filter(Boolean),
        secondaryContactIds: [],
      },
    });
  }

  // Gather all linked contacts (primary + secondaries)
  const allContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: primaryContact.id },
        { linkedId: primaryContact.id },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Check if new info needs to be added as secondary
  const emailExists = allContacts.some((c) => c.email === email);
  const phoneExists = allContacts.some((c) => c.phoneNumber === phoneNumber);

  let newSecondary = null;
  if (
    (email && !emailExists) ||
    (phoneNumber && !phoneExists)
  ) {
    newSecondary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "secondary",
        linkedId: primaryContact.id,
      },
    });
    allContacts.push(newSecondary);
  }

  // Prepare response
  const emails = [
    primaryContact.email,
    ...allContacts
      .filter((c) => c.email && c.email !== primaryContact.email)
      .map((c) => c.email!),
  ].filter(Boolean);

  const phoneNumbers = [
    primaryContact.phoneNumber,
    ...allContacts
      .filter((c) => c.phoneNumber && c.phoneNumber !== primaryContact.phoneNumber)
      .map((c) => c.phoneNumber!),
  ].filter(Boolean);

  const secondaryContactIds = allContacts
    .filter((c) => c.linkPrecedence === "secondary")
    .map((c) => c.id);

  res.json({
    contact: {
      primaryContatctId: primaryContact.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  });
});

export default router;

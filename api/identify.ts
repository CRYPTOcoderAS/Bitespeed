import { PrismaClient, Contact } from "@prisma/client";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();

interface ContactResponse {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber } = req.body as { email?: string; phoneNumber?: string };

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "email or phoneNumber required" });
  }

  try {
    // Build the where clause for the query
    const whereClause: any = { OR: [] };
    
    if (email) whereClause.OR.push({ email });
    if (phoneNumber) whereClause.OR.push({ phoneNumber });
    
    // Find all contacts matching email or phoneNumber
    const contacts = await prisma.contact.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' }
    });

    // Find or create primary contact
    let primaryContact = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];

    // If no contacts found, create a new primary contact
    if (!primaryContact) {
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: 'primary',
        },
      });
      
      const response = {
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        },
      };
      
      return res.status(200).json(response);
    }

    // Gather all linked contacts (primary + secondaries)
    const allContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: primaryContact.id },
          { linkedId: primaryContact.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Check if new info needs to be added as secondary
    const emailExists = email ? allContacts.some(c => c.email === email) : false;
    const phoneExists = phoneNumber ? allContacts.some(c => c.phoneNumber === phoneNumber) : false;

    if ((email && !emailExists) || (phoneNumber && !phoneExists)) {
      const newSecondary = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: 'secondary',
          linkedId: primaryContact.id,
        },
      });
      allContacts.push(newSecondary);
    }

    // Prepare response
    const emails = Array.from(new Set([
      primaryContact.email,
      ...allContacts
        .filter(c => c.email && c.email !== primaryContact.email)
        .map(c => c.email)
        .filter((e): e is string => e !== null)
    ])).filter(Boolean) as string[];

    const phoneNumbers = Array.from(new Set([
      primaryContact.phoneNumber,
      ...allContacts
        .filter(c => c.phoneNumber && c.phoneNumber !== primaryContact.phoneNumber)
        .map(c => c.phoneNumber)
        .filter((p): p is string => p !== null)
    ])).filter(Boolean) as string[];

    const secondaryContactIds = allContacts
      .filter(c => c.linkPrecedence === 'secondary')
      .map(c => c.id);

    const response = {
      contact: {
        primaryContatctId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in identify endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

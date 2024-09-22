const Booking = require('../models/Booking');


// Create a booking
exports.createBooking = async (req, res) => {
  const { subscriptionType, slotId, gymId, bookingDate, subscriptionId} = req.body;

  try {
    const booking = await Booking.create({
      slotId,
      gymId,
      userId: req.user.id,
      bookingDate,
      type: subscriptionType,
      subscriptionId
    });

    res.status(201).send(booking);
  } catch (error) {
    res.status(400).send(error.message);
  }
};

// Invite Buddies
exports.inviteBuddies = async (req, res) => {
  const { bookingId, buddyIds } = req.body;

  try {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    await booking.update({ invitedBuddies: [...booking.invitedBuddies, ...buddyIds] });
    res.send('Buddies invited successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
};


// Fetch all bookings by User
exports.getAllBookingsByUser = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        userId: req.user.id // Fetch bookings for the logged-in user
      }
    });

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this user' });
    }

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).send('Server error');
  }
};


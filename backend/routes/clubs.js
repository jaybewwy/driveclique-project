const express = require('express');
const router = express.Router();
const { 
  createClub, 
  getUserClubs, 
  getClubById, 
  getClubByInviteCode,
  requestToJoinClub,
  handleJoinRequest,
  searchClubs,
  toggleClubPrivacy,
  joinClubByInviteCode,
  deleteClub
} = require('../controllers/clubController');
const { protect } = require('../middleware/authentication');

router.use(protect);

router.post('/', createClub);
router.get('/', getUserClubs);
router.get('/browse', searchClubs);
router.post('/join-by-code/:inviteCode', joinClubByInviteCode);
router.get('/invite/:inviteCode', getClubByInviteCode);
router.get('/:clubId', getClubById);
router.post('/:clubId/join', requestToJoinClub);
router.post('/:clubId/handle-request', handleJoinRequest);
router.post('/:clubId/toggle-privacy', toggleClubPrivacy);
router.delete('/:clubId', deleteClub);

module.exports = router;

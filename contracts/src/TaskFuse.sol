// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TaskFuse
/// @notice A minimal bounty escrow where posters select a recorded contributor.
contract TaskFuse {
    uint256 public constant MAX_SUBMISSIONS = 100;
    uint256 public constant MIN_DURATION = 5 minutes;
    uint256 public constant MAX_DURATION = 90 days;

    enum Status { Missing, Open, Awarded, Reclaimed }

    struct Bounty {
        address poster;
        address winner;
        uint128 reward;
        uint64 createdAt;
        uint64 deadline;
        uint16 submissionCount;
        Status status;
        bytes32 taskHash;
        string title;
    }

    struct Submission {
        address contributor;
        uint64 submittedAt;
        bytes32 proofHash;
        string note;
    }

    uint256 public bountyCount;
    mapping(uint256 => Bounty) private bounties;
    mapping(uint256 => Submission[]) private submissions;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    uint256 private locked = 1;

    event BountyOpened(uint256 indexed bountyId, address indexed poster, uint256 reward, uint64 deadline, bytes32 taskHash, string title);
    event SubmissionAdded(uint256 indexed bountyId, uint256 indexed submissionId, address indexed contributor, bytes32 proofHash, string note);
    event BountyAwarded(uint256 indexed bountyId, uint256 indexed submissionId, address indexed winner, uint256 reward);
    event BountyReclaimed(uint256 indexed bountyId, address indexed poster, uint256 reward);

    error InvalidInput();
    error UnknownBounty();
    error NotPoster();
    error BountyClosed();
    error DeadlinePassed();
    error DeadlineActive();
    error AlreadySubmitted();
    error PosterCannotSubmit();
    error SubmissionLimit();
    error InvalidSubmission();
    error TransferFailed();
    error ReentrantCall();

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    modifier existing(uint256 bountyId) {
        if (bounties[bountyId].status == Status.Missing) revert UnknownBounty();
        _;
    }

    function openBounty(string calldata title, bytes32 taskHash, uint64 duration) external payable returns (uint256 bountyId) {
        uint256 titleLength = bytes(title).length;
        if (
            titleLength == 0 ||
            titleLength > 64 ||
            taskHash == bytes32(0) ||
            msg.value == 0 ||
            msg.value > type(uint128).max
        ) revert InvalidInput();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidInput();
        bountyId = ++bountyCount;
        uint64 createdAt = uint64(block.timestamp);
        uint64 deadline = createdAt + duration;
        bounties[bountyId] = Bounty({
            poster: msg.sender,
            winner: address(0),
            reward: uint128(msg.value),
            createdAt: createdAt,
            deadline: deadline,
            submissionCount: 0,
            status: Status.Open,
            taskHash: taskHash,
            title: title
        });
        emit BountyOpened(bountyId, msg.sender, msg.value, deadline, taskHash, title);
    }

    function submit(uint256 bountyId, string calldata note, bytes32 proofHash) external existing(bountyId) {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != Status.Open) revert BountyClosed();
        if (block.timestamp >= bounty.deadline) revert DeadlinePassed();
        if (msg.sender == bounty.poster) revert PosterCannotSubmit();
        if (hasSubmitted[bountyId][msg.sender]) revert AlreadySubmitted();
        if (bounty.submissionCount >= MAX_SUBMISSIONS) revert SubmissionLimit();
        uint256 noteLength = bytes(note).length;
        if (noteLength == 0 || noteLength > 280) revert InvalidInput();

        submissions[bountyId].push(Submission(msg.sender, uint64(block.timestamp), proofHash, note));
        hasSubmitted[bountyId][msg.sender] = true;
        uint256 submissionId = bounty.submissionCount++;
        emit SubmissionAdded(bountyId, submissionId, msg.sender, proofHash, note);
    }

    function award(uint256 bountyId, uint256 submissionId) external nonReentrant existing(bountyId) {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.poster) revert NotPoster();
        if (bounty.status != Status.Open) revert BountyClosed();
        if (submissionId >= submissions[bountyId].length) revert InvalidSubmission();
        address winner = submissions[bountyId][submissionId].contributor;
        uint256 amount = bounty.reward;
        bounty.status = Status.Awarded;
        bounty.winner = winner;
        bounty.reward = 0;
        (bool ok,) = payable(winner).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit BountyAwarded(bountyId, submissionId, winner, amount);
    }

    function reclaim(uint256 bountyId) external nonReentrant existing(bountyId) {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.poster) revert NotPoster();
        if (bounty.status != Status.Open) revert BountyClosed();
        if (block.timestamp < bounty.deadline) revert DeadlineActive();
        uint256 amount = bounty.reward;
        bounty.status = Status.Reclaimed;
        bounty.reward = 0;
        (bool ok,) = payable(bounty.poster).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit BountyReclaimed(bountyId, bounty.poster, amount);
    }

    function getBounty(uint256 bountyId) external view existing(bountyId) returns (Bounty memory) {
        return bounties[bountyId];
    }

    function getSubmissions(uint256 bountyId) external view existing(bountyId) returns (Submission[] memory) {
        return submissions[bountyId];
    }

    receive() external payable { revert InvalidInput(); }
}


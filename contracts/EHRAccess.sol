// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stores encrypted-record identifiers and patient-controlled permissions.
/// @dev Never put medical data, decryption keys, or personally identifiable health data on-chain.
contract EHRAccess {
    struct Record {
        address patient;
        string ipfsCid;
        bytes32 encryptedContentHash;
        uint256 createdAt;
        bool exists;
    }

    uint256 private nextRecordId = 1;
    mapping(uint256 => Record) private records;
    mapping(uint256 => mapping(address => bool)) private accessGranted;

    event RecordRegistered(uint256 indexed recordId, address indexed patient, string ipfsCid, bytes32 encryptedContentHash);
    event AccessGranted(uint256 indexed recordId, address indexed patient, address indexed clinician);
    event AccessRevoked(uint256 indexed recordId, address indexed patient, address indexed clinician);

    modifier onlyPatient(uint256 recordId) {
        require(records[recordId].exists, "Record does not exist");
        require(records[recordId].patient == msg.sender, "Only record owner");
        _;
    }

    function registerRecord(string calldata ipfsCid, bytes32 encryptedContentHash) external returns (uint256 recordId) {
        require(bytes(ipfsCid).length > 0, "CID is required");
        recordId = nextRecordId++;
        records[recordId] = Record(msg.sender, ipfsCid, encryptedContentHash, block.timestamp, true);
        emit RecordRegistered(recordId, msg.sender, ipfsCid, encryptedContentHash);
    }

    function grantAccess(uint256 recordId, address clinician) external onlyPatient(recordId) {
        require(clinician != address(0), "Invalid clinician");
        accessGranted[recordId][clinician] = true;
        emit AccessGranted(recordId, msg.sender, clinician);
    }

    function revokeAccess(uint256 recordId, address clinician) external onlyPatient(recordId) {
        accessGranted[recordId][clinician] = false;
        emit AccessRevoked(recordId, msg.sender, clinician);
    }

    function canAccess(uint256 recordId, address account) external view returns (bool) {
        Record storage record = records[recordId];
        return record.exists && (record.patient == account || accessGranted[recordId][account]);
    }

    function getRecord(uint256 recordId) external view returns (Record memory) {
        require(records[recordId].exists, "Record does not exist");
        require(msg.sender == records[recordId].patient || accessGranted[recordId][msg.sender], "Access denied");
        return records[recordId];
    }
}

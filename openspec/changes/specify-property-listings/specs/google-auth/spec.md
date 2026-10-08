# Spec Delta

## Purpose

Define el acceso rapido mediante Google para que publicar y administrar propiedades sea simple y no requiera registro manual.

## ADDED Requirements

### Requirement: Google login
The system SHALL allow users to sign in using a Google account before publishing or managing properties.

#### Scenario: User signs in with Google
- **WHEN** a visitor chooses Google login and completes Google authentication
- **THEN** the system creates or resumes a user session for that Google identity

### Requirement: Publishing requires authentication
The system SHALL require an active authenticated session for create, edit and delete operations on properties.

#### Scenario: Anonymous user opens publishing flow
- **WHEN** a visitor without an active session starts the publishing flow
- **THEN** the system directs them to Google login before showing the publish form

### Requirement: Session identity owns content
The system SHALL associate each created property with the authenticated user identity that created it.

#### Scenario: User creates a property after login
- **WHEN** an authenticated user publishes a property
- **THEN** the system stores that user as the property author

# Spec Delta

## Purpose

Define la experiencia central para publicar, consultar y administrar propiedades inmobiliarias con fotos, descripcion, precio y datos persistidos.

## ADDED Requirements

### Requirement: Public property listing
The system SHALL show published properties with photos, price, short description and enough location context to understand the offer.

#### Scenario: Visitor views a property card
- **WHEN** a visitor opens the property listing experience
- **THEN** the system shows each published property with at least one photo, price, short description and location summary

### Requirement: Authenticated property publishing
The system SHALL allow only authenticated users to create property publications with photos, price, description and exact location.

#### Scenario: Authenticated user publishes a property
- **WHEN** an authenticated user submits valid property photos, price, description and location
- **THEN** the system saves the property and makes it available as a published listing

#### Scenario: Anonymous user attempts to publish
- **WHEN** a visitor without a session tries to publish a property
- **THEN** the system requires login before accepting the publication

### Requirement: Property photo upload
The system SHALL allow the property author to upload one or more property photos and preserve them with the listing.

#### Scenario: Author adds photos
- **WHEN** the author uploads valid image files while creating or editing a property
- **THEN** the system associates those photos with the property for later display

### Requirement: Property editing
The system SHALL allow a property author to edit photos, description, price and location of their own publications.

#### Scenario: Author saves changes
- **WHEN** the author updates valid fields for one of their properties and saves
- **THEN** the system persists the changes and shows the updated publication

### Requirement: Property deletion
The system SHALL allow a property author to delete their own publications.

#### Scenario: Author deletes a property
- **WHEN** the author confirms deletion of one of their properties
- **THEN** the system removes the property from public listings

### Requirement: Author-only management
The system SHALL prevent users from editing or deleting properties they do not own.

#### Scenario: User attempts to edit another author's property
- **WHEN** an authenticated user requests an edit or delete action for another author's property
- **THEN** the system rejects the action and leaves the property unchanged

### Requirement: Seller property management
The system SHALL show authenticated sellers a management view containing only properties authored by their current session.

#### Scenario: Seller opens their management session
- **WHEN** an authenticated seller opens the seller management view
- **THEN** the system shows only properties where the author matches the current user

### Requirement: Property sold state
The system SHALL allow a property author to mark their own publication as sold.

#### Scenario: Author marks a property as sold
- **WHEN** the author uses the sold action for one of their properties
- **THEN** the system persists the property status as sold

#### Scenario: User attempts to mark another author's property as sold
- **WHEN** an authenticated user requests the sold action for another author's property
- **THEN** the system rejects the action and leaves the property status unchanged

### Requirement: Sold property badge
The system SHALL display a visible red sold ribbon with the text VENDIDO on sold property images.

#### Scenario: Visitor views a sold property
- **WHEN** a property with sold status is displayed
- **THEN** the primary property image includes a red ribbon labeled VENDIDO

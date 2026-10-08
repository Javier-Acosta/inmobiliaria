# Spec Delta

## Purpose

Define como los usuarios visualizan la ubicacion exacta de una propiedad usando Google Maps dentro de una experiencia clara y minimalista.

## ADDED Requirements

### Requirement: Exact property map
The system SHALL show a Google Map for a property using the exact location saved for that publication.

#### Scenario: Visitor opens property detail
- **WHEN** a visitor opens a property detail with saved coordinates
- **THEN** the system displays a Google Map centered on the property location

### Requirement: Location capture for publishing
The system SHALL allow an authenticated author to provide the exact property location when publishing or editing.

#### Scenario: Author selects property location
- **WHEN** the author selects or enters a valid location for a property
- **THEN** the system stores the location so it can be shown on the property map

### Requirement: Map failure fallback
The system SHALL keep property details understandable if Google Maps cannot load.

#### Scenario: Map provider is unavailable
- **WHEN** a property page cannot load the Google Map
- **THEN** the system still shows the property photos, price, description and textual location context

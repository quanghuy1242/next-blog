import React from 'react';
import { render, screen } from '@testing-library/react';
import { Banner } from 'components/pages/index/banner';
import type { Media } from 'types/cms';

describe('Banner component', () => {
  test('renders header and subheader', () => {
    render(<Banner header="Hello" subHeader="World" className="custom" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  test('uses imageBanner when provided', () => {
    const mockImageBanner: Media = {
      id: 1,
      url: 'https://example.com/custom-banner.jpg',
      alt: 'Custom banner image',
    };

    render(
      <Banner
        header="Test Header"
        subHeader="Test Subheader"
        imageBanner={mockImageBanner}
      />
    );

    const image = screen.getByAltText('Custom banner image');
    expect(image).toBeInTheDocument();
  });

  test('uses placeholder when imageBanner is not provided', () => {
    render(<Banner header="Test" subHeader="Test" />);

    const image = screen.getByAltText('Banner background');
    expect(image).toBeInTheDocument();
  });
});

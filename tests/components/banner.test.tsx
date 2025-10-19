import React from 'react';
import { render, screen } from '@testing-library/react';
import { Banner } from 'components/pages/index/banner';

describe('Banner component', () => {
  test('renders header and subheader', () => {
    render(<Banner header="Hello" subHeader="World" className="custom" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });
});

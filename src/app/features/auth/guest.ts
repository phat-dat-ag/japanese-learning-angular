import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guest',
  imports: [RouterLink],
  templateUrl: './guest.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Guest { }
